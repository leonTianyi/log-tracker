"""The rules that stop a careless triage from dirtying the dataset.

Two kinds:
  * warnings — surfaced on the log detail, non-blocking (a nudge).
  * gates    — enforced when someone tries to advance a stage (a wall).

Adding a rule later is meant to be a one-function change.
"""

from __future__ import annotations

from .models import Log


def warnings_for(log: Log) -> list[dict]:
    """Non-blocking nudges shown on the log detail."""
    fv = log.field_values or {}
    out: list[dict] = []

    # Site-aware vehicles are GPS-tracked and normally filtered out of the
    # pointcloud — but we WANT to train on them, so the SA filter must be off.
    if fv.get("site_aware_vehicles") is True and not fv.get("disable_sa_filter"):
        out.append(
            {
                "level": "warning",
                "message": (
                    "Site-aware vehicles are present but the SA filter isn't "
                    "disabled — turn on the disable_sa_filter amendment or those "
                    "machines get dropped from training."
                ),
            }
        )

    # If you've said positive labels exist, they need classes.
    if fv.get("has_positive_labels") is True and not fv.get("classes_present"):
        out.append(
            {
                "level": "warning",
                "message": "Positive labels marked, but no classes recorded yet.",
            }
        )

    return out


def gate_for_stage(log: Log, stage_key: str, new_state: str) -> str | None:
    """Return a reason string if the transition is NOT allowed, else None."""
    if new_state != "done":
        return None

    # Can't mark shipped (PR + sync) until labeling is done.
    if stage_key == "ship":
        label = next((s for s in log.stages if s.stage == "label"), None)
        if label is None or label.state != "done":
            return "Can't mark shipped: labeling isn't done yet."

    return None
