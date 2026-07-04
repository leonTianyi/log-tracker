"""Deriving a stable identity for a log from its S3 path.

The whole design leans on this. Two facts we rely on:

  * The two buckets for one legacy log hold *slightly different* timestamps in
    their trailing segment (they were written by different machines), so the
    timestamp is unreliable and MUST be stripped before comparing.
  * The trailing name and the year.month token are stable across the CSVs, so
    together they form the log's identity.

natural_key = "<date token>/<name>"   e.g. "2026.05/checkout_run"
            = "<name>"                 when no date token is found (with a note)

Everything here is pure functions with no database or framework, so it can be
unit-tested in isolation — see tests/test_keys.py.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

# A leading clock time on the trailing segment, e.g. "01.12.30_checkout_run".
# This is the part that drifts between buckets, so we strip it.
_TIME_PREFIX = re.compile(r"^\d{1,2}\.\d{2}\.\d{2}_")

# Date tokens that may appear as their own path segment.
# Day-level is preferred because it shrinks the collision window to a single day.
_DATE_DAY = re.compile(r"^\d{4}\.\d{2}\.\d{2}$")   # 2026.05.14
_DATE_MONTH = re.compile(r"^\d{4}\.\d{2}$")        # 2026.05


@dataclass(frozen=True)
class ParsedPath:
    uri: str
    bucket: str
    name: str                 # trailing segment, timestamp removed
    date_token: str | None    # "2026.05" or "2026.05.14" or None
    natural_key: str

    @property
    def has_date(self) -> bool:
        return self.date_token is not None


def _segments(uri: str) -> tuple[str, list[str]]:
    """Return (bucket, non-empty path segments) from an s3:// uri."""
    parsed = urlparse(uri.strip())
    bucket = parsed.netloc
    segments = [s for s in parsed.path.split("/") if s]
    return bucket, segments


def strip_timestamp(segment: str) -> str:
    """Remove a leading HH.MM.SS_ timestamp from a segment, if present."""
    return _TIME_PREFIX.sub("", segment)


def find_date_token(segments: list[str]) -> str | None:
    """Prefer a day-level token; fall back to month-level; else None."""
    day = next((s for s in segments if _DATE_DAY.match(s)), None)
    if day is not None:
        return day
    return next((s for s in segments if _DATE_MONTH.match(s)), None)


def parse_path(uri: str) -> ParsedPath:
    """Turn a full S3 uri into its parsed identity."""
    bucket, segments = _segments(uri)
    name = strip_timestamp(segments[-1]) if segments else ""
    date_token = find_date_token(segments)
    natural_key = f"{date_token}/{name}" if date_token else name
    return ParsedPath(
        uri=uri.strip(),
        bucket=bucket,
        name=name,
        date_token=date_token,
        natural_key=natural_key,
    )
