"""Exhaling a fresh amendment CSV from the database.

The mirror image of flag_loader.py. Where that reads amendment columns *in*,
this writes them back *out* — as a brand-new, timestamped file with the same
column shape your batch pipeline expects. The team's original CSV is never
touched; this is a snapshot the DB breathes out, not an edit of the source.

Rules settled with the owner:
  * One row per log, every log (no "touched only" filtering).
  * Columns: the two path columns, then every active amendment field's key,
    in the order those fields are defined (sort_order).
  * Bools render as 1 / 0 to match the source sheet.
  * A flag that was imported keeps whatever value the DB holds.
  * A flag that was never set (never in the source, never edited) exports blank.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime

from sqlmodel import Session, select

from .config import MIRROR_COLUMN, PRIMARY_COLUMN
from .models import FieldDefinition, Log


def _render(value: object, ftype: str) -> str:
    """Turn a stored field value into its CSV cell. None -> blank."""
    if value is None:
        return ""
    if ftype == "bool":
        return "1" if value else "0"
    return str(value)


def export_amendment_csv(session: Session) -> tuple[str, str]:
    """Return (filename, csv_text) for the current state of every log."""
    amend_fields = session.exec(
        select(FieldDefinition)
        .where(
            FieldDefinition.category == "amendment",
            FieldDefinition.active == True,  # noqa: E712
        )
        .order_by(FieldDefinition.sort_order)
    ).all()
    flag_keys = [f.key for f in amend_fields]
    ftype_by_key = {f.key: f.type for f in amend_fields}

    header = [PRIMARY_COLUMN, MIRROR_COLUMN, *flag_keys]

    logs = session.exec(select(Log).order_by(Log.natural_key)).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)

    for log in logs:
        primary = next((p.uri for p in log.paths if p.kind == "primary"), "")
        mirror = next((p.uri for p in log.paths if p.kind == "mirror"), "")
        fv = log.field_values or {}
        row = [primary, mirror]
        for key in flag_keys:
            row.append(_render(fv.get(key), ftype_by_key[key]))
        writer.writerow(row)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"amendment_export_{stamp}.csv", buf.getvalue()


def export_preview(session: Session) -> dict:
    """Lightweight info for the UI before the download: columns + log count."""
    amend_fields = session.exec(
        select(FieldDefinition)
        .where(
            FieldDefinition.category == "amendment",
            FieldDefinition.active == True,  # noqa: E712
        )
        .order_by(FieldDefinition.sort_order)
    ).all()
    log_count = len(session.exec(select(Log)).all())
    return {
        "log_count": log_count,
        "columns": [PRIMARY_COLUMN, MIRROR_COLUMN, *[f.key for f in amend_fields]],
        "flag_columns": [f.key for f in amend_fields],
    }
