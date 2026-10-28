"""Run: python test_analysis.py  (synthetic data, no network)"""
import pandas as pd
from app import analysis

utc = lambda s: pd.Timestamp(s, tz="UTC")
actuals = pd.DataFrame({"startTime": [utc("2026-01-10 12:00")], "actual": [5000.0]})
fc = pd.DataFrame({
    "startTime": [utc("2026-01-10 12:00")] * 4,
    "publishTime": [utc("2026-01-09 06:00"), utc("2026-01-09 09:00"),
                    utc("2026-01-09 10:00"), utc("2026-01-10 08:00")],
    "forecast": [4000.0, 4500.0, 9999.0, 9999.0],
})
df = analysis.build_dataset(actuals, fc)
assert len(df) == 1
assert df.loc[0, "forecast"] == 4500.0, "must pick 09:00 D-1 (<= cutoff), not later ones"
assert df.loc[0, "error"] == -500.0
m = analysis.metrics(df)
assert m["mae"] == 500.0 and m["bias"] == -500.0
print("OK", m)
