// Mirrors backend/app/config.py STAGES. Kept here so the UI knows the order
// and labels without an extra round-trip. If you change the stages in the
// backend, update this list too.
export const STAGES: { key: string; label: string }[] = [
  { key: "preprocess", label: "Preprocess / amend prep" },
  { key: "amend", label: "Batch amendment (S3)" },
  { key: "resim", label: "Resim & confirm" },
  { key: "label", label: "Label + classes" },
  { key: "ship", label: "PR + sync back" },
];

export const STAGE_STATES = ["todo", "in_progress", "done", "blocked", "na"];
