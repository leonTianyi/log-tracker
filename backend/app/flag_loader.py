"""Loading amendment-flag *values* from a CSV into existing logs.

Separate from importer.py on purpose. import_csv() creates logs from their
paths; this reads the amendment-flag columns (whose headers match your defined
amendment field keys) and writes their coerced values onto logs that already
exist.

Nothing is guessed. A value that doesn't fit its field's declared type is
reported as an error (with row, column, value, and reason) rather than being
silently coerced or dropped — so a wrong field type surfaces immediately.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date

from sqlmodel import Session, select

from .config import MIRROR_COLUMN, PRIMARY_COLUMN
from .keys import parse_path
from .models import FieldDefinition, Log

# Sentinel: an empty cell means "leave this flag untouched", not "set to empty".
_SKIP = object()


@dataclass
class FlagLoadError:
    row_number: int
    column: str
    value: str
    message: str


@dataclass
class FlagLoadResult:
    rows_total: int = 0
    logs_updated: int = 0
    values_set: int = 0
    columns_matched: list[str] = field(default_factory=list)
    columns_missing: list[str] = field(default_factory=list)
    unmatched_rows: int = 0
    errors: list[FlagLoadError] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "rows_total": self.rows_total,
            "logs_updated": self.logs_updated,
            "values_set": self.values_set,
            "columns_matched": self.columns_matched,
            "columns_missing": self.columns_missing,
            "unmatched_rows": self.unmatched_rows,
            "errors": [
                {
                    "row_number": e.row_number,
                    "column": e.column,
                    "value": e.value,
                    "message": e.message,
                }
                for e in self.errors
            ],
        }


def _coerce(raw: str, ftype: str, options: list | None):
    """Return (ok, value_or_SKIP, error_message). Empty -> (True, _SKIP, None)."""
    val = (raw or "").strip()
    if val == "":
        return True, _SKIP, None

    if ftype == "bool":
        low = val.lower()
        if low in ("1", "true", "yes", "y", "t"):
            return True, True, None
        if low in ("0", "false", "no", "n", "f"):
            return True, False, None
        return False, None, f"'{val}' isn't a yes/no value (use 1/0, true/false)"

    if ftype == "number":
        try:
            num = float(val)
        except ValueError:
            return False, None, f"'{val}' isn't a number"
        return True, (int(num) if num.is_integer() else num), None

    if ftype == "enum":
        if options and val in options:
            return True, val, None
        allowed = ", ".join(options or [])
        return False, None, f"'{val}' isn't one of: {allowed}"

    if ftype == "date":
        try:
            date.fromisoformat(val)  # expects YYYY-MM-DD
        except ValueError:
            return False, None, f"'{val}' isn't a date (expected YYYY-MM-DD)"
        return True, val, None

    # text
    return True, val, None


def load_amendment_flags(session: Session, raw: bytes) -> FlagLoadResult:
    result = FlagLoadResult()

    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None or PRIMARY_COLUMN not in reader.fieldnames:
        raise ValueError(
            f"CSV is missing the required column '{PRIMARY_COLUMN}'. "
            f"Found columns: {reader.fieldnames}"
        )

    columns = set(reader.fieldnames)
    amend_fields = session.exec(
        select(FieldDefinition).where(
            FieldDefinition.category == "amendment",
            FieldDefinition.active == True,  # noqa: E712
        )
    ).all()

    matched = [f for f in amend_fields if f.key in columns]
    result.columns_matched = [f.key for f in matched]
    result.columns_missing = [f.key for f in amend_fields if f.key not in columns]

    if not matched:
        return result  # nothing to load; caller sees columns_missing

    for offset, row in enumerate(reader, start=2):
        result.rows_total += 1

        primary = (row.get(PRIMARY_COLUMN) or "").strip()
        mirror = (row.get(MIRROR_COLUMN) or "").strip()
        present = [u for u in (primary, mirror) if u]
        if not present:
            continue

        keys = {parse_path(u).natural_key for u in present}
        if len(keys) > 1:
            result.errors.append(
                FlagLoadError(
                    offset, "(identity)", " vs ".join(sorted(keys)),
                    "buckets disagree on identity; row skipped",
                )
            )
            continue

        natural_key = keys.pop()
        log = session.exec(select(Log).where(Log.natural_key == natural_key)).first()
        if log is None:
            result.unmatched_rows += 1
            continue

        fv = dict(log.field_values or {})
        changed = False
        for f in matched:
            ok, coerced, msg = _coerce(row.get(f.key, ""), f.type, f.options)
            if not ok:
                result.errors.append(
                    FlagLoadError(offset, f.key, (row.get(f.key) or "").strip(),
                                  f"field '{f.key}' (type {f.type}): {msg}")
                )
                continue
            if coerced is _SKIP:
                continue
            if fv.get(f.key) != coerced:
                fv[f.key] = coerced
                changed = True
                result.values_set += 1

        if changed:
            log.field_values = fv  # reassign so SQLAlchemy sees the change
            session.add(log)
            result.logs_updated += 1

    session.commit()
    return result
