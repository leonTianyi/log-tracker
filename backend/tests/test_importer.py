from pathlib import Path

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.importer import import_csv
from app.models import Log, LogPath

SAMPLE = Path(__file__).resolve().parent.parent / "sample_data" / "sample_logs.csv"


def fresh_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_import_counts_and_guardrail():
    session = fresh_session()
    raw = SAMPLE.read_bytes()
    result = import_csv(session, raw)

    assert result.rows_total == 5
    # rows 1, 2, 3 create; row 5 is an exact dup of row 2 (matches); row 4 flags
    assert result.logs_created == 3
    assert result.logs_matched == 1
    assert result.paths_added == 5  # 2 + 1 + 2 + 0(dup)
    assert len(result.flagged) == 1
    assert "disagree" in result.flagged[0].reason


def test_legacy_log_has_two_paths():
    session = fresh_session()
    import_csv(session, SAMPLE.read_bytes())
    log = session.exec(
        select(Log).where(Log.natural_key == "2026.05/checkout_run")
    ).first()
    assert log is not None
    assert len(log.paths) == 2
    assert {p.kind for p in log.paths} == {"primary", "mirror"}


def test_march_run_is_separate_from_may_run():
    session = fresh_session()
    import_csv(session, SAMPLE.read_bytes())
    keys = {log.natural_key for log in session.exec(select(Log)).all()}
    assert "2026.05/checkout_run" in keys
    assert "2026.03/checkout_run" in keys


def test_reimport_is_idempotent():
    session = fresh_session()
    raw = SAMPLE.read_bytes()
    import_csv(session, raw)
    second = import_csv(session, raw)

    assert second.logs_created == 0
    assert second.paths_added == 0
    assert second.logs_matched == 4  # rows 1,2,3,5 all match; row 4 still flags

    total_logs = len(session.exec(select(Log)).all())
    total_paths = len(session.exec(select(LogPath)).all())
    assert total_logs == 3
    assert total_paths == 5
