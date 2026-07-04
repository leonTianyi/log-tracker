"""Ingesting a CSV row-by-row and upserting logs.

Rules, in plain terms:
  * One row = one log. The primary column is always present; the mirror column
    is filled only for legacy two-bucket logs.
  * Identity is the natural_key derived from the path (date + name), never the
    raw path — so drifting timestamps between the two buckets don't matter.
  * If the two buckets on a row resolve to DIFFERENT keys, we refuse to guess:
    the row is flagged for human eyes and nothing is merged. Silent corruption
    is the one thing this tool exists to prevent.
  * Re-importing the same CSV changes nothing (idempotent): logs match on
    natural_key, paths match on their unique uri.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field

from sqlmodel import Session, select

from .config import MIRROR_COLUMN, PRIMARY_COLUMN, STAGE_KEYS
from .keys import parse_path
from .models import Log, LogPath, StageStatus


@dataclass
class FlaggedRow:
    row_number: int
    reason: str
    detail: str = ""


@dataclass
class ImportResult:
    rows_total: int = 0
    logs_created: int = 0
    logs_matched: int = 0
    paths_added: int = 0
    flagged: list[FlaggedRow] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "rows_total": self.rows_total,
            "logs_created": self.logs_created,
            "logs_matched": self.logs_matched,
            "paths_added": self.paths_added,
            "flagged": [
                {"row_number": f.row_number, "reason": f.reason, "detail": f.detail}
                for f in self.flagged
            ],
        }


def _ensure_stage_rows(session: Session, log: Log) -> None:
    for stage_key in STAGE_KEYS:
        session.add(StageStatus(log_id=log.id, stage=stage_key, state="todo"))


def import_csv(session: Session, raw: bytes, created_by: str | None = None) -> ImportResult:
    result = ImportResult()

    text = raw.decode("utf-8-sig")  # tolerate a BOM
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None or PRIMARY_COLUMN not in reader.fieldnames:
        raise ValueError(
            f"CSV is missing the required column '{PRIMARY_COLUMN}'. "
            f"Found columns: {reader.fieldnames}"
        )

    # csv rows start after the header, so the first data row is line 2.
    for offset, row in enumerate(reader, start=2):
        result.rows_total += 1

        primary_uri = (row.get(PRIMARY_COLUMN) or "").strip()
        mirror_uri = (row.get(MIRROR_COLUMN) or "").strip()

        present: list[tuple[str, str]] = []
        if primary_uri:
            present.append(("primary", primary_uri))
        if mirror_uri:
            present.append(("mirror", mirror_uri))

        if not present:
            result.flagged.append(
                FlaggedRow(offset, "empty row", "no S3 path in either bucket column")
            )
            continue

        parsed = [(kind, parse_path(uri)) for kind, uri in present]
        keys = {p.natural_key for _, p in parsed}

        # The guardrail: two buckets that disagree on identity are never merged.
        if len(keys) > 1:
            result.flagged.append(
                FlaggedRow(
                    offset,
                    "buckets disagree on identity",
                    " vs ".join(sorted(keys)),
                )
            )
            continue

        natural_key = keys.pop()
        if not natural_key:
            result.flagged.append(
                FlaggedRow(offset, "could not derive a name", present[0][1])
            )
            continue

        log = session.exec(select(Log).where(Log.natural_key == natural_key)).first()
        if log is None:
            log = Log(natural_key=natural_key, created_by=created_by)
            session.add(log)
            session.flush()  # populate log.id so paths/stages can reference it
            _ensure_stage_rows(session, log)
            result.logs_created += 1
        else:
            result.logs_matched += 1

        for kind, p in parsed:
            existing = session.exec(
                select(LogPath).where(LogPath.uri == p.uri)
            ).first()
            if existing is None:
                session.add(
                    LogPath(log_id=log.id, bucket=p.bucket, uri=p.uri, kind=kind)
                )
                result.paths_added += 1
            elif existing.log_id != log.id:
                result.flagged.append(
                    FlaggedRow(
                        offset,
                        "path already belongs to a different log",
                        p.uri,
                    )
                )
        session.flush()

    session.commit()
    return result
