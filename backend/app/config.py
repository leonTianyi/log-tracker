"""Small knobs that are likely to change per-team. Kept in one place on purpose."""

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
# the mirror is only filled for legacy two-bucket logs. Change these to match
# your team's exact CSV headers.
PRIMARY_COLUMN = "ics-1ahs-prod"
MIRROR_COLUMN = "ics-cfh-prod"
