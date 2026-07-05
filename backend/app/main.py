"""The FastAPI app: import, logs, stages, fields — plus serving the built UI."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlmodel import Session, select

from .config import STAGE_KEYS, STAGE_LABELS, STAGE_STATES
from .db import create_db_and_tables, engine, get_session
from .exporter import export_amendment_csv, export_preview
from .flag_loader import load_amendment_flags
from .importer import import_csv
from .models import FieldDefinition, Log, LogPath, StageStatus
from .seed import seed_fields
from .validation import gate_for_stage, warnings_for

app = FastAPI(title="Log Triage Tracker", version="0.1.0")

# Dev only: the Vite dev server runs on a different port and needs CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        seed_fields(session)


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------

def compute_current_stage(stages: list[StageStatus]) -> str:
    by_key = {s.stage: s for s in stages}
    for key in STAGE_KEYS:
        st = by_key.get(key)
        if st is None or st.state != "done":
            return key
    return "complete"


def log_summary(log: Log) -> dict:
    stage_map = {s.stage: s.state for s in log.stages}
    return {
        "id": log.id,
        "natural_key": log.natural_key,
        "current_stage": compute_current_stage(log.stages),
        "stages": [
            {"stage": k, "label": STAGE_LABELS[k], "state": stage_map.get(k, "todo")}
            for k in STAGE_KEYS
        ],
        "path_count": len(log.paths),
        "field_values": log.field_values or {},
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


def log_detail(log: Log) -> dict:
    data = log_summary(log)
    data["paths"] = [
        {"id": p.id, "bucket": p.bucket, "uri": p.uri, "kind": p.kind}
        for p in sorted(log.paths, key=lambda p: p.kind)
    ]
    data["stage_detail"] = [
        {
            "stage": s.stage,
            "label": STAGE_LABELS.get(s.stage, s.stage),
            "state": s.state,
            "done_at": s.done_at.isoformat() if s.done_at else None,
            "done_by": s.done_by,
        }
        for s in sorted(log.stages, key=lambda s: STAGE_KEYS.index(s.stage)
                        if s.stage in STAGE_KEYS else 99)
    ]
    data["warnings"] = warnings_for(log)
    return data


# ----------------------------------------------------------------------------
# routes
# ----------------------------------------------------------------------------

@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/import")
async def import_endpoint(
    file: UploadFile, session: Session = Depends(get_session)
) -> dict:
    raw = await file.read()
    try:
        result = import_csv(session, raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result.as_dict()


@app.post("/api/import/amendment-flags")
async def load_flags_endpoint(
    file: UploadFile, session: Session = Depends(get_session)
) -> dict:
    raw = await file.read()
    try:
        result = load_amendment_flags(session, raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result.as_dict()


@app.get("/api/export/amendment-flags/preview")
def export_flags_preview(session: Session = Depends(get_session)) -> dict:
    return export_preview(session)


@app.get("/api/export/amendment-flags")
def export_flags(session: Session = Depends(get_session)) -> Response:
    filename, text = export_amendment_csv(session)
    return Response(
        content=text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/logs")
def list_logs(
    q: str | None = None,
    stage: str | None = None,
    session: Session = Depends(get_session),
) -> list[dict]:
    logs = session.exec(select(Log).order_by(Log.natural_key)).all()
    out = []
    for log in logs:
        if q and q.lower() not in log.natural_key.lower():
            continue
        summary = log_summary(log)
        if stage and summary["current_stage"] != stage:
            continue
        out.append(summary)
    return out


@app.get("/api/logs/{log_id}")
def get_log(log_id: int, session: Session = Depends(get_session)) -> dict:
    log = session.get(Log, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    return log_detail(log)


class FieldValuesUpdate(BaseModel):
    field_values: dict


@app.patch("/api/logs/{log_id}")
def update_log(
    log_id: int, payload: FieldValuesUpdate, session: Session = Depends(get_session)
) -> dict:
    log = session.get(Log, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    merged = dict(log.field_values or {})
    merged.update(payload.field_values)
    log.field_values = merged
    session.add(log)
    session.commit()
    session.refresh(log)
    return log_detail(log)


class StageUpdate(BaseModel):
    state: str
    done_by: str | None = None


@app.post("/api/logs/{log_id}/stages/{stage_key}")
def set_stage(
    log_id: int,
    stage_key: str,
    payload: StageUpdate,
    session: Session = Depends(get_session),
) -> dict:
    if stage_key not in STAGE_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown stage '{stage_key}'")
    if payload.state not in STAGE_STATES:
        raise HTTPException(status_code=400, detail=f"Unknown state '{payload.state}'")

    log = session.get(Log, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")

    gate = gate_for_stage(log, stage_key, payload.state)
    if gate is not None:
        raise HTTPException(status_code=409, detail=gate)

    st = next((s for s in log.stages if s.stage == stage_key), None)
    if st is None:
        st = StageStatus(log_id=log.id, stage=stage_key)
        session.add(st)

    st.state = payload.state
    if payload.state == "done":
        st.done_at = datetime.utcnow()
        st.done_by = payload.done_by
    else:
        st.done_at = None
        st.done_by = None

    log.current_stage = compute_current_stage(
        [s if s.stage != stage_key else st for s in log.stages]
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log_detail(log)


# ---- fields ---------------------------------------------------------------

@app.get("/api/fields")
def list_fields(session: Session = Depends(get_session)) -> list[dict]:
    fields = session.exec(
        select(FieldDefinition).order_by(FieldDefinition.category,
                                         FieldDefinition.sort_order)
    ).all()
    return [f.model_dump() for f in fields]


class FieldCreate(BaseModel):
    key: str
    label: str
    type: str = "text"
    options: list | None = None
    category: str = "metadata"
    sort_order: int = 100


@app.post("/api/fields")
def create_field(
    payload: FieldCreate, session: Session = Depends(get_session)
) -> dict:
    exists = session.exec(
        select(FieldDefinition).where(FieldDefinition.key == payload.key)
    ).first()
    if exists is not None:
        raise HTTPException(status_code=409, detail=f"Field '{payload.key}' exists")
    field = FieldDefinition(**payload.model_dump())
    session.add(field)
    session.commit()
    session.refresh(field)
    return field.model_dump()


class FieldUpdate(BaseModel):
    label: str | None = None
    type: str | None = None
    options: list | None = None
    category: str | None = None
    sort_order: int | None = None
    active: bool | None = None


@app.patch("/api/fields/{field_id}")
def update_field(
    field_id: int, payload: FieldUpdate, session: Session = Depends(get_session)
) -> dict:
    field = session.get(FieldDefinition, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(field, k, v)
    session.add(field)
    session.commit()
    session.refresh(field)
    return field.model_dump()


@app.delete("/api/fields/{field_id}")
def delete_field(field_id: int, session: Session = Depends(get_session)) -> dict:
    field = session.get(FieldDefinition, field_id)
    if field is None:
        raise HTTPException(status_code=404, detail="Field not found")
    session.delete(field)
    session.commit()
    return {"deleted": field_id}


# ---- serve the built frontend (one-container prod mode) -------------------
# When frontend/dist has been built and copied to ./static, serve it here so
# the whole app is a single container. In dev you use the Vite server instead.
_static_dir = Path(__file__).resolve().parent.parent / "static"
if _static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
