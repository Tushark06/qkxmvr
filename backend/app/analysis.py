"""Core logic.

Decision rule (assumption, explain in README/video):
  Day-ahead purchase for delivery day D is made on D-1 at CUTOFF_HOUR (UK local time).
  For each matched interval on D we use the LATEST forecast with publishTime <= that cutoff.
  (WINDFOR is hourly, so exact startTime matching gives 24 intervals/day.)
"""
import numpy as np
import pandas as pd

TZ = "Europe/London"
CUTOFF_HOUR = 9


def select_decision_forecast(fc: pd.DataFrame, cutoff_hour: int = CUTOFF_HOUR) -> pd.DataFrame:
    df = fc.copy()
    local = df["startTime"].dt.tz_convert(TZ)
    df["delivery_date"] = local.dt.normalize().dt.tz_localize(None)
    cutoff_naive = df["delivery_date"] - pd.Timedelta(days=1) + pd.Timedelta(hours=cutoff_hour)
    df["cutoff"] = cutoff_naive.dt.tz_localize(TZ, ambiguous="NaT", nonexistent="shift_forward").dt.tz_convert("UTC")
    df = df[df["publishTime"] <= df["cutoff"]]
    df = df.sort_values("publishTime").groupby("startTime", as_index=False).last()
    df["delivery_date"] = df["startTime"].dt.tz_convert(TZ).dt.strftime("%Y-%m-%d")
    df["horizon_h"] = (df["startTime"] - df["publishTime"]).dt.total_seconds() / 3600
    return df


def build_dataset(actuals: pd.DataFrame, fc: pd.DataFrame, cutoff_hour: int = CUTOFF_HOUR) -> pd.DataFrame:
    dec = select_decision_forecast(fc, cutoff_hour)
    df = dec.merge(actuals, on="startTime", how="left")
    df = df[df["delivery_date"].between("2026-01-01", "2026-01-31")]
    df["error"] = df["forecast"] - df["actual"]
    df["hour"] = df["startTime"].dt.tz_convert(TZ).dt.hour
    return df.sort_values("startTime").reset_index(drop=True)


def metrics(df: pd.DataFrame) -> dict:
    d = df.dropna(subset=["actual", "forecast"])
    if d.empty:
        return {"n": 0}
    e = d["error"]
    ae = e.abs()
    mean_actual = d["actual"].mean()
    nz = d[d["actual"] > 0]
    return {
        "n": int(len(d)),
        "mae": round(float(ae.mean()), 1),
        "rmse": round(float(np.sqrt((e ** 2).mean())), 1),
        "bias": round(float(e.mean()), 1),  # +ve = over-forecast
        "overforecast_pct": round(float((e > 0).mean() * 100), 1),
        "underforecast_pct": round(float((e < 0).mean() * 100), 1),
        "mape": round(float((nz["error"].abs() / nz["actual"]).mean() * 100), 1) if len(nz) else None,
        "nmae_pct": round(float(ae.mean() / mean_actual * 100), 1) if mean_actual else None,
        "p90_abs_error": round(float(np.percentile(ae, 90)), 1),
        "max_abs_error": round(float(ae.max()), 1),
        "mean_actual": round(float(mean_actual), 1),
    }


def to_records(df: pd.DataFrame) -> list[dict]:
    out = df.copy()
    out["startTime"] = out["startTime"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    out["publishTime"] = out["publishTime"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    out = out[["startTime", "publishTime", "forecast", "actual", "error", "horizon_h"]]
    return out.replace({np.nan: None}).to_dict("records")


def breakdown(df: pd.DataFrame, by: str) -> list[dict]:
    rows = []
    for key, g in df.groupby(by):
        m = metrics(g)
        if m["n"]:
            rows.append({by: key if by != "hour" else int(key), **m})
    return rows
