from app.keys import find_date_token, parse_path, strip_timestamp


def test_legacy_pair_resolves_to_same_key_despite_timestamp_drift():
    a = parse_path("s3://ics-1ahs-prod/data/TPG/2026.05/coll/01.12.32_checkout_run/")
    b = parse_path("s3://ics-cfh-prod/data/TPG/2026.05/coll/01.12.30_checkout_run/")
    assert a.natural_key == b.natural_key == "2026.05/checkout_run"
    assert a.bucket == "ics-1ahs-prod"
    assert b.bucket == "ics-cfh-prod"


def test_same_name_different_month_gives_different_keys():
    may = parse_path("s3://b/x/2026.05/c/01.00.00_checkout_run/")
    mar = parse_path("s3://b/x/2026.03/c/01.00.00_checkout_run/")
    assert may.natural_key != mar.natural_key


def test_day_level_token_is_preferred_over_month():
    p = parse_path("s3://b/x/2026.05.14/c/01.00.00_run/")
    assert p.date_token == "2026.05.14"
    assert p.natural_key == "2026.05.14/run"


def test_no_date_token_falls_back_to_name_only():
    p = parse_path("s3://b/logs/01.00.00_orphan_run/")
    assert p.date_token is None
    assert p.natural_key == "orphan_run"


def test_strip_timestamp():
    assert strip_timestamp("01.12.30_checkout_run") == "checkout_run"
    assert strip_timestamp("no_timestamp_here") == "no_timestamp_here"


def test_find_date_token():
    assert find_date_token(["x", "2026.05", "y"]) == "2026.05"
    assert find_date_token(["x", "y"]) is None
