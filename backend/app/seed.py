"""Seed a few example fields so a fresh install has something to show.

These are examples — edit or delete them freely from the Fields screen. The
real amendment flag names get added here (or in the UI) once they're known.
"""

from __future__ import annotations

from sqlmodel import Session, select

from .models import FieldDefinition

_DEFAULTS = [
    # amendment flags (feed the batch CSV later)
    dict(key="disable_sa_filter", label="Disable site-aware filter",
         type="bool", category="amendment", sort_order=10),
    dict(key="add_mod2_channels", label="Add MOD2 channels",
         type="bool", category="amendment", sort_order=20),
    # metadata (triage notes)
    dict(key="site_aware_vehicles", label="Has site-aware vehicles",
         type="bool", category="metadata", sort_order=10),
    dict(key="confirmed_by_resim", label="Confirmed by resim",
         type="bool", category="metadata", sort_order=20),
    dict(key="has_positive_labels", label="Has positive labels",
         type="bool", category="metadata", sort_order=30),
    dict(key="classes_present", label="Classes present",
         type="text", category="metadata", sort_order=40),
    dict(key="location", label="Location / site",
         type="text", category="metadata", sort_order=50),
    dict(key="weather", label="Weather", type="enum",
         options=["clear", "rain", "snow", "fog", "night"],
         category="metadata", sort_order=60),
    dict(key="notes", label="Notes", type="text",
         category="metadata", sort_order=70),
]


def seed_fields(session: Session) -> None:
    existing = session.exec(select(FieldDefinition)).first()
    if existing is not None:
        return
    for d in _DEFAULTS:
        session.add(FieldDefinition(**d))
    session.commit()
