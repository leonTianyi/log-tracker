# Log Triage Tracker

A self-enforcing checklist and metadata store for log triage. It sits *beside*
your team's CSVs (which stay the source of truth) and remembers the things the
CSVs don't: how far each log has moved through triage, the metadata you record,
and the amendment flags you intend to set — with validation rules that catch the
mistakes that quietly dirty curated training data.

This is **Phase 1**: runs on one machine, single user, SQLite. Auth, Postgres,
AWS, and real S3 sync come later (see the roadmap at the bottom).

---

## What it does

- **Import a CSV** of logs. One row = one log, with two bucket columns
  (`s3-bucket-name1` primary, `s3-bucket-name2` mirror). Re-importing the same file
  changes nothing.
- **Identify a log by meaning, not by path.** Two buckets hold the same legacy
  log under slightly different timestamps; the app strips the timestamp and keys
  each log by `date/name` (e.g. `2026.05/checkout_run`). A May `checkout_run`
  and a March one stay separate. If a row's two buckets disagree on identity,
  the row is **flagged, never merged** — silent corruption is the whole thing
  this tool exists to prevent.
- **Track each log through five stages:** preprocess → batch amendment → resim →
  label → PR + sync back. Each stage carries a state (to do / in progress / done
  / blocked / N/A) and remembers who finished it and when.
- **Record metadata and amendment flags** per log, from fields you define in the
  UI — no code changes to add a new one.
- **Enforce rules.** Warnings surface on the log (e.g. site-aware vehicles
  present but the SA filter isn't disabled). Gates block bad transitions (you
  can't mark a log shipped before labeling is done).

---

## Run it (the easy way: Docker)

You need Docker Desktop (or Docker Engine + Compose). From the project root:

```bash
docker compose up --build
```

Then open **http://localhost:8000**. That's it — one container serves both the
UI and the API. The SQLite database lives in `./data/` on your machine, so it
survives rebuilds. To stop: `Ctrl+C`, or `docker compose down`.

First run seeds a handful of example fields so the screens aren't empty. Go to
the **Import** tab and feed it `backend/sample_data/sample_logs.csv` to see the
matching (and the flagged-row guardrail) in action.

---

## Run it (the dev way: hot reload)

Useful when you want to change code and see it live. Two terminals.

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually **http://localhost:5173**). The dev server
proxies `/api` to the backend on port 8000, so both halves talk to each other.

---

## The one idea worth understanding: the log key

Everything hangs on turning an S3 path into a stable identity:

```
s3://ics-cfh-prod/.../ABC/2026.05/.../01.12.30_checkout_run/
                          └── date ──┘        └── name ──┘   (timestamp stripped)

            natural_key  =  2026.05/checkout_run
```

Both buckets of one legacy log produce the same key, so they fold into one log
with two paths. Different months with the same name produce different keys, so
they stay apart. The logic lives in `backend/app/keys.py` and is covered by
`backend/tests/test_keys.py` — run `cd backend && python -m pytest` to see it.

If a path also carries a day (`2026.05.14`), the app uses that instead of the
month, shrinking the collision window further.

---

## Adding your real amendment flags

The seeded fields are placeholders. To add your team's real amendment flags:

1. Open the **Fields** tab.
2. Add a field: give it a key (the stored name, no spaces — e.g.
   `disable_sa_filter`), a label, a type (usually `bool` for a flag), and set
   **category = amendment**.
3. It now appears on every log's detail under "Amendment flags."

Metadata fields work the same way with **category = metadata**. Nothing about
the database changes — fields are data, not schema.

To wire a new *validation rule* around a flag (like the SA-filter warning), edit
`backend/app/validation.py`. Each rule is a small, self-contained function.

---

## Project layout

```
log-tracker/
├── docker-compose.yml        one-command run
├── Dockerfile                builds frontend, serves it + API from Python
├── backend/
│   ├── app/
│   │   ├── keys.py           the log-identity logic  ← the crux
│   │   ├── importer.py       CSV import + never-fuse guardrail
│   │   ├── validation.py     warnings + stage gates
│   │   ├── models.py         the four tables
│   │   ├── main.py           API routes + serves the built UI
│   │   ├── config.py         stages + CSV column names
│   │   └── seed.py           example fields on first run
│   ├── tests/                pytest: keys + importer
│   └── sample_data/          a CSV to try
└── frontend/
    └── src/
        ├── components/       Logs, LogDetail, Import, Fields
        ├── api.ts            typed calls to the backend
        └── stages.ts         stage list (mirrors backend config)
```

If your real CSV headers differ from `xxx-xxx-xxx` / `yyy-yyy-yyy`, change
them in one place: `backend/app/config.py`.

---

## Roadmap

**Phase 2 — multi-user.** Log-in and per-user attribution, swap SQLite for
Postgres (change one env var), deploy to AWS.

**Phase 3 — closing the loop.** Export/regenerate the amendment CSV from the
flags recorded here; real S3 sync-state checks; hooks into the batch-amendment
job; ingest third-party annotation results back onto the log.
