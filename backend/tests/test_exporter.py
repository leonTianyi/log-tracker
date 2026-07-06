import csv
import io
from pathlib import Path

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.exporter import export_amendment_csv
from app.flag_loader import load_amendment_flags
from app.importer import import_csv
from app.seed import seed_fields

SAMPLE = Path(__file__).resolve().parent.parent / "sample_data" / "sample_logs.csv"


def fresh_session() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _rows(text: str):
    return list(csv.reader(io.StringIO(text)))


def test_export_header_has_paths_then_amendment_keys():
    session = fresh_session()
    seed_fields(session)
    import_csv(session, SAMPLE.read_bytes())
    _, text = export_amendment_csv(session)
    header = _rows(text)[0]
    assert header[:2] == ["s3-bucket-1", "s3-bucket-2"]
    # seeded amendment fields appear as columns
    assert "disable_sa_filter" in header
    assert "add_mod2_channels" in header


def test_unset_flags_export_blank_set_flags_render_1_0():
    session = fresh_session()
    seed_fields(session)
    import_csv(session, SAMPLE.read_bytes())

    flags = (
        b"s3-bucket-1,s3-bucket-2,disable_sa_filter,add_mod2_channels\n"
        b"s3://s3-bucket-1/data/site_a/2026.05/collection_a/01.12.32_checkout_run/,,1,0\n"
    )
    load_amendment_flags(session, flags)

    _, text = export_amendment_csv(session)
    rows = _rows(text)
    header = rows[0]
    di = header.index("disable_sa_filter")
    ai = header.index("add_mod2_channels")

    by_key = {r[0]: r for r in rows[1:]}
    may = by_key["s3://s3-bucket-1/data/site_a/2026.05/collection_a/01.12.32_checkout_run/"]
    assert may[di] == "1"
    assert may[ai] == "0"

    # the March log was never given flags -> blank cells, not zeros
    march = by_key[
        "s3://s3-bucket-1/data/site_a/2026.03/collection_c/22.45.01_checkout_run/"
    ]
    assert march[di] == ""
    assert march[ai] == ""


def test_one_row_per_log():
    session = fresh_session()
    seed_fields(session)
    import_csv(session, SAMPLE.read_bytes())
    _, text = export_amendment_csv(session)
    rows = _rows(text)
    # 3 logs created from the sample -> 3 data rows + 1 header
    assert len(rows) == 1 + 3


def test_text_amendment_field_exports_its_literal_value():
    """Non-bool amendment fields (text/number/enum) export their value as-is;
    only bool is special-cased to 1/0, and unset stays blank."""
    from app.models import FieldDefinition

    session = fresh_session()
    seed_fields(session)
    # a text amendment flag, e.g. a free-form channel spec
    session.add(FieldDefinition(key="channel_spec", label="Channel spec",
                                type="text", category="amendment", sort_order=99))
    session.commit()
    import_csv(session, SAMPLE.read_bytes())

    flags = (
        b"s3-bucket-1,s3-bucket-2,channel_spec\n"
        b"s3://s3-bucket-1/data/site_a/2026.05/collection_a/01.12.32_checkout_run/,,lidar+radar\n"
    )
    load_amendment_flags(session, flags)

    _, text = export_amendment_csv(session)
    rows = _rows(text)
    header = rows[0]
    ci = header.index("channel_spec")
    by_key = {r[0]: r for r in rows[1:]}

    may = by_key["s3://s3-bucket-1/data/site_a/2026.05/collection_a/01.12.32_checkout_run/"]
    assert may[ci] == "lidar+radar"          # text value survives verbatim

    march = by_key["s3://s3-bucket-1/data/site_a/2026.03/collection_c/22.45.01_checkout_run/"]
    assert march[ci] == ""                    # never set -> blank
