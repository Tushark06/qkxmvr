import os
from functools import lru_cache

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import analysis, elexon

app = FastAPI(title="Wind Forecast Monitor API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)


@lru_cache(maxsize=8)
def get_dataset(cutoff_hour: int) -> pd.DataFrame:
    try:
        actuals = elexon.fetch_actuals()
        fc = elexon.fetch_forecasts()
    except Exception as exc:  # network / API errors
        raise HTTPException(502, f"Elexon API error: {exc}")
    return analysis.build_dataset(actuals, fc, cutoff_hour)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/config")
def config():
    return {
        "cutoff_hour_uk": analysis.CUTOFF_HOUR,
        "month": "2026-01",
        "rule": "Latest forecast published at or before D-1 cutoff (UK time) for each matched hourly interval of day D (WINDFOR is hourly, so 24 points/day, not 48)",
    }


@app.get("/api/forecast")
def forecast(date: str = Query(..., description="Delivery date YYYY-MM-DD"),
             cutoff_hour: int = analysis.CUTOFF_HOUR):
    df = get_dataset(cutoff_hour)
    day = df[df["delivery_date"] == date]
    if day.empty:
        raise HTTPException(404, "No data for this date")
    return {
        "date": date,
        "cutoff_hour_uk": cutoff_hour,
        "forecast_published_max": day["publishTime"].max().isoformat(),
        "metrics": analysis.metrics(day),
        "points": analysis.to_records(day),
    }


@app.get("/api/coverage")
def coverage(cutoff_hour: int = analysis.CUTOFF_HOUR):
    """Raw counts + matched rows, so the UI can state coverage honestly."""
    try:
        actuals = elexon.fetch_actuals()
        fc = elexon.fetch_forecasts()
    except Exception as exc:
        raise HTTPException(502, f"Elexon API error: {exc}")
    df = analysis.build_dataset(actuals, fc, cutoff_hour)
    return {
        "actuals_rows": int(len(actuals)),
        "forecast_rows": int(len(fc)),
        "matched_rows": int(len(df)),
        "matched_per_day": 24,
        "actuals_note": "FUELHH half-hourly: 31 days x 48 = 1488 expected",
        "matched_note": "WINDFOR is hourly, so exact startTime matching gives 24 matched points/day",
    }


@app.get("/api/metrics")
def metrics(cutoff_hour: int = analysis.CUTOFF_HOUR):
    df = get_dataset(cutoff_hour)
    return {
        "overall": analysis.metrics(df),
        "by_day": analysis.breakdown(df, "delivery_date"),
        "by_hour": analysis.breakdown(df, "hour"),
    }
