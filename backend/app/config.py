"""Small knobs that are likely to change per-team. Kept in one place on purpose."""

import os

# The five triage stages, in order. (key, human label)
STAGES: list[tuple[str, str]] = [
    ("preprocess", "Preprocess / amend prep"),
    ("amend", "Batch amendment (S3)"),
    ("resim", "Resim & confirm"),
    ("label", "Label + classes"),
    ("ship", "PR + sync back"),
]
STAGE_KEYS: list[str] = [k for k, _ in STAGES]
STAGE_LABELS: dict[str, str] = dict(STAGES)

# States a stage can be in.
STAGE_STATES = ["todo", "in_progress", "done", "blocked", "na"]

# The two CSV columns that hold the S3 paths. The primary is always present;
# the mirror is only filled for legacy two-bucket logs.
#
# These are real, potentially sensitive header names, so they are NOT hardcoded
# here. Set them via environment variables (see .env.example); the generic
# defaults below are safe to commit and keep the app working out of the box for
# the sample data.
PRIMARY_COLUMN = os.environ.get("PRIMARY_COLUMN", "s3-bucket-1")
MIRROR_COLUMN = os.environ.get("MIRROR_COLUMN", "s3-bucket-2")

