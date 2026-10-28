"""Elexon BMRS client: fetches FUELHH (actual wind) and WINDFOR (wind forecasts).
Data is fetched in small chunks and cached on disk so the app is fast and the API is hit once.
"""
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pandas as pd

# Workaround: some runtimes set NO_PROXY with bracketed IPv6 entries
# ("[::1]") that httpx mis-parses as a port. Localhost bypass is all we need.
for _k in ("NO_PROXY", "no_proxy"):
    if "[" in os.environ.get(_k, ""):
        os.environ[_k] = "localhost,127.0.0.1"

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
# Default cache lives next to the code (backend/data_cache), so it works
# regardless of the working directory and ships with the deployed image.
_DEFAULT_CACHE = Path(__file__).resolve().parent.parent / "data_cache"
CACHE_DIR = Path(os.getenv("CACHE_DIR", _DEFAULT_CACHE))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Jan 2026 delivery days. Forecasts for 1 Jan are published from late Dec,
# so we pull forecasts from ~Dec 20 (extra look-back) to Feb 1.
ACTUALS_FROM = "2026-01-01"
ACTUALS_TO = "2026-01-31"
FORECAST_PUB_FROM = datetime(2025, 12, 20, tzinfo=timezone.utc)
FORECAST_PUB_TO = datetime(2026, 2, 1, tzinfo=timezone.utc)
CHUNK_DAYS = 3


def _get(url: str, params: dict) -> list[dict]:
    with httpx.Client(timeout=60) as client:
        r = client.get(url, params={**params, "format": "json"})
        r.raise_for_status()
        data = r.json()
    return data if isinstance(data, list) else data.get("data", [])


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_actuals() -> pd.DataFrame:
    cache = CACHE_DIR / "actuals.json"
    if cache.exists():
        rows = json.loads(cache.read_text())
    else:
        rows = []
        start = datetime.fromisoformat(ACTUALS_FROM)
        end = datetime.fromisoformat(ACTUALS_TO)
        cur = start
        while cur <= end:
            to = min(cur + timedelta(days=CHUNK_DAYS - 1), end)
            rows += _get(
                f"{BASE}/FUELHH/stream",
                {
                    "settlementDateFrom": cur.strftime("%Y-%m-%d"),
                    "settlementDateTo": to.strftime("%Y-%m-%d"),
                    "fuelType": "WIND",
                },
            )
            cur = to + timedelta(days=1)
        cache.write_text(json.dumps(rows))
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["startTime", "actual"])
    df = df[df["fuelType"] == "WIND"]
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df = df.drop_duplicates("startTime").rename(columns={"generation": "actual"})
    return df[["startTime", "actual"]].sort_values("startTime").reset_index(drop=True)


def fetch_forecasts() -> pd.DataFrame:
    cache = CACHE_DIR / "forecasts.json"
    if cache.exists():
        rows = json.loads(cache.read_text())
    else:
        rows = []
        cur = FORECAST_PUB_FROM
        while cur < FORECAST_PUB_TO:
            to = min(cur + timedelta(days=CHUNK_DAYS), FORECAST_PUB_TO)
            rows += _get(
                f"{BASE}/WINDFOR/stream",
                {"publishDateTimeFrom": _iso(cur), "publishDateTimeTo": _iso(to)},
            )
            cur = to
        cache.write_text(json.dumps(rows))
    df = pd.DataFrame(rows)
    if df.empty:
        return pd.DataFrame(columns=["startTime", "publishTime", "forecast"])
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
    df = df.drop_duplicates(["startTime", "publishTime"]).rename(columns={"generation": "forecast"})
    return df[["startTime", "publishTime", "forecast"]]
