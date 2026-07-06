# CLAUDE.md

Briefing for any AI agent (Claude Code, the VS Code extension, etc.) working in
this repo. Read this first. It carries context that isn't obvious from the code
alone.

---

## What this project is

An internal **log-triage tracker** for a robotics/perception team. It sits
*beside* the team's CSVs (which stay the source of truth for immutable log data)
and owns the things the CSVs don't: triage process-state, per-log metadata, and
amendment flags — with validation rules that catch the mistakes that quietly
corrupt curated training/eval data.

The owner is Python-native and new to web/TypeScript. Prefer clear explanations
over cleverness. This is **Phase 1**: single machine, single user, SQLite.

---

## THE ONE RULE THAT MUST NOT BREAK

**A log's identity is derived, and two logs must never be silently fused.**

- Identity = `natural_key`, formed as `<date>/<name>` (e.g. `2026.05/checkout_run`),
  built in `backend/app/keys.py` by stripping the drifting `HH.MM.SS_` timestamp
  and reading the `YYYY.MM` (or `YYYY.MM.DD`) token from the S3 path.
- The two S3 buckets for one legacy log hold slightly different timestamps, so
  the raw path is NOT the identity — only the derived key is.
- In `backend/app/importer.py`, if a row's two buckets resolve to **different**
  keys, the row is **flagged, never merged**. This guardrail is the entire
  reason the tool exists. Do not weaken it, "smooth it over," or auto-resolve
  disagreements.

**Before you touch `keys.py` or `importer.py`, run the tests. After you touch
them, run the tests again.** If a change makes a test fail, the change is wrong
until proven otherwise — do not edit the test to make it pass without explicit
human confirmation.

```bash
cd backend && python -m pytest
```

The known collision the key cannot resolve alone: two logs with the **same name
in the same month**. That is exactly why the never-fuse guardrail stays on
permanently rather than trusting the key blindly. Do not "optimize" it away.

---

## How to run

**Docker (one command, serves UI + API on one port):**
```bash
docker compose up --build      # then open http://localhost:8000
```

**Local dev (hot reload, no Docker):**
```bash
# terminal 1
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
# terminal 2
cd frontend && npm install && npm run dev      # opens http://localhost:5173
```

The Vite dev server proxies `/api` → `localhost:8000`. In the Docker build,
FastAPI serves the built UI from `./static`, so there is no proxy in prod.

---

## Architecture

```
backend/   FastAPI + SQLModel + SQLite (Python — keep domain logic here)
frontend/  React + TypeScript + Vite + Tailwind (hand-rolled components)
```

The `backend/` and `frontend/` folder names are referenced by the Dockerfile —
do not rename them.

### Backend files
- `app/keys.py` — natural-key derivation. **The crux.** Pure functions, unit-tested.
- `app/importer.py` — CSV import, upsert, never-fuse guardrail, idempotency.
- `app/flag_loader.py` — loads amendment-flag *values* from CSV columns onto
  existing logs, coercing to each field's type and reporting mismatches. Uses
  the same natural-key matching as the importer.
- `app/exporter.py` — the mirror of flag_loader: rebuilds a fresh amendment CSV
  from the DB (path columns + amendment keys, bools as 1/0, unset = blank, one
  row per log). Writes a new timestamped file; never edits the source CSV.
- `app/validation.py` — `warnings_for(log)` (non-blocking nudges) and
  `gate_for_stage(...)` (hard blocks). Add new rules as small functions here.
- `app/models.py` — the four tables: `Log`, `LogPath`, `StageStatus`, `FieldDefinition`.
- `app/main.py` — API routes; also mounts the built UI at `/` if `./static` exists.
- `app/config.py` — stage list + CSV column names. Change team-specific knobs here.
- `app/db.py` — engine/session; `DATABASE_URL` env var (default SQLite).
- `app/seed.py` — example fields seeded on first run (placeholders — safe to change).

### Data model notes
- Per-log answers live in `Log.field_values` (a JSON dict), **not** a column
  named `metadata` — SQLAlchemy reserves `metadata` on models. Do not rename it back.
- `FieldDefinition.category` is `"metadata"` or `"amendment"`. Amendment flags
  will feed the batch CSV in a later phase; metadata is everything else. Fields
  are data, not schema — new fields are added via the UI, no migration.

---

## Known traps (already paid for — don't re-pay them)

- **Do NOT add `from __future__ import annotations` to `app/models.py`.** It
  stringifies the relationship type hints and breaks SQLModel's mapper init
  (`list["LogPath"]` becomes an unresolvable string). It's fine in other modules.
- **`TestClient` must be used as a context manager** (`with TestClient(app) as c:`)
  or the startup hook never runs and tables aren't created.
- `datetime.utcnow()` raises a deprecation warning under Python 3.12. Harmless
  for now; if you modernize it, keep stored datetimes naive-UTC to avoid
  SQLite comparison mismatches.

---

## Conventions

- **Stages are defined in two places that must stay in sync:**
  `backend/app/config.py` (`STAGES`) and `frontend/src/stages.ts` (`STAGES`).
  Change both, or the UI and API disagree.
- CSV bucket column names are set via `PRIMARY_COLUMN` / `MIRROR_COLUMN`
  environment variables (see `.env.example`), NOT hardcoded — the real names are
  sensitive and must never be committed. `config.py` falls back to generic
  placeholders (`s3-bucket-1`, `s3-bucket-2`). Never write real bucket names,
  project codes, or other internal identifiers into committed files (code, docs,
  tests, or sample data); use placeholders.
- Frontend components are hand-rolled Tailwind (shadcn/ui deliberately deferred).
  Aesthetic: dark control-room — charcoal surfaces, monospace for S3 paths/keys,
  one cold violet accent. Keep it legible and dense; usability over flourish.
- Run `npm run build` in `frontend/` to typecheck (`tsc --noEmit`) before committing UI changes.

---

## Working style in this repo

- Make the smallest change that solves the problem. This is a first web project;
  don't introduce new frameworks, state libraries, or patterns without asking.
- Commit-friendly: the owner keeps this in git. Prefer focused diffs.
- If a design decision is ambiguous, ask before implementing — decisions here
  are meant to be settled before code is written.

---

## Roadmap (scope awareness)

- **Phase 1 (current):** schema, import + matching, log list/detail, field
  settings, core validations, SQLite, single container. — DONE.
- **Phase 3 (in progress, prioritized over Phase 2 at owner's request):**
  amendment CSV export — DONE (see `exporter.py`, Export tab). Still ahead: S3
  sync-state checks, batch-amendment hooks, third-party annotation ingestion.
- **Phase 2 (deferred):** auth + per-user attribution, Postgres (swap
  `DATABASE_URL`), AWS. The owner is staying single-user for now.

Do not build Phase 2 features unless explicitly asked.
