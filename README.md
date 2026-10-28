# UK Day-Ahead Wind Forecast Monitor — January 2026

This app is for a UK energy company that buys electricity a day in advance.
For any delivery day in January 2026, it shows the wind forecast that was
actually available when the purchase decision had to be made, compares it
with what really happened, and shows how big the forecast error was.

**Live app:** https://uk-wind-forecast-tushars-projects-5ad452d1.vercel.app

On Vercel, the frontend and the API run together. The API in `frontend/api/`
serves the same January 2026 data as the FastAPI backend in `backend/`, just
from a compact snapshot made from live Elexon data. Running it locally or
with Docker still uses the FastAPI backend directly (see below).

## The problem, in short

Demand minus wind generation is roughly the power that has to be bought
from somewhere else. Wind depends on the weather, so it cannot be controlled.
The purchase for tomorrow has to be decided today, using a forecast. If the
forecast says more wind than there really is, the company ends up short and
has to buy urgently later. If it says less wind, the company buys too much.

This app only covers the wind part. It does not use demand or price data,
so it does not tell anyone how much to buy. It just shows the forecast,
the actual, and the error, so the trader can decide the safety margin.

## The main rule — no looking ahead

For delivery day D, the decision is made on D-1 at **09:00 UK time**.
For each hour of day D, the app takes the **latest forecast published at
or before that cutoff**. A forecast published after the cutoff is never
used here, even if it later turned out to be more accurate.

The 09:00 time is my assumption, not a market rule — different products
have different auction times. That is why the cutoff is a control in the
UI and in the API (`?cutoff_hour=...`), not something hidden in the code.

Real example: for 10 January 2026 at the 09:00 cutoff, the latest usable
forecast was published at 07:30 on 9 January. A forecast published at
09:30 on 9 January is in the feed, but it is not used.

## Results for January 2026 (09:00 cutoff)

Checked against live Elexon data (see "Data" below):

| Metric | Value |
|---|---|
| Matched intervals | 744 (31 days × 24) |
| MAE | 2,127.5 MW |
| RMSE | 2,606.1 MW |
| Bias (forecast − actual) | +1,851.5 MW |
| Over-forecast share | 84.8% |
| MAPE | 22.2% |
| Mean actual wind | 11,581.1 MW |
| P90 absolute error | 4,306.4 MW |
| Max absolute error | 6,894.0 MW |

In plain terms: in January 2026 the forecast mostly said more wind than
there was. A trader who trusted it as it was would usually have been short.
The worst day was 1 January (MAE 4,223.2 MW). A better day was 15 January
(MAE 1,025.2 MW, and all 24 hours were over-forecast that day).

## Why 24 points a day, not 48

This is deliberate, not a bug, and it is worth understanding:

- Actuals (FUELHH) are half-hourly: 31 days × 48 = **1,488** rows, and
  all 1,488 were fetched.
- Forecasts (WINDFOR) in this feed are **hourly** — only `:00` start times.
- Matching on exact `startTime` gives **24** matched points per day,
  744 in total. The `:30` actuals are in the data, but they have no
  forecast at the same timestamp, so they are not paired with the
  neighbouring hour's forecast just to make the numbers look bigger.

Another way (repeating each hourly forecast over both half-hours, or
averaging the two half-hour actuals) would still give 24 hourly rows,
it would just change what "actual" means. Exact matching keeps both
series as published.

## Data — Elexon only

- **Actuals:** BMRS `FUELHH` stream, `fuelType=WIND`,
  `settlementDateFrom=2026-01-01`, `settlementDateTo=2026-01-31`.
  Docs: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream
- **Forecasts:** BMRS `WINDFOR` stream, `publishDateTimeFrom=2025-12-20`
  to `2026-02-01`. The December look-back is there so forecasts for
  1 January, published in late December, are not missed.
  Docs: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream
- The backend caches both feeds in `backend/data_cache/*.json` (3.2 MB,
  committed with the repo). With the cache present, the first run is
  instant. Delete the cache files to force a fresh live fetch — that
  takes around 40 seconds for January, with chunked requests to respect
  rate limits (the API returns 429 if hit too fast).
- Nothing else is used. No demand, price, weather, or other-fuel data
  is fetched or made up.

## Metrics

For each matched interval, `error = forecast − actual` (MW):

- **Bias** = mean(error). Positive means the forecast was usually too high.
- **MAE** = mean(|error|). The typical size of the error.
- **RMSE** = sqrt(mean(error²)). This punishes big errors more, so it is
  the risk number.
- **MAPE** = mean(|error| / actual) × 100, over intervals with actual > 0.
- **nMAE** = MAE / mean(actual) × 100. Scale-free, since installed
  capacity is not in these datasets.
- **P90 absolute error** = 90th percentile of |error|. 90% of January
  intervals were within this error, so it is a usable margin number.
- **Over/under-forecast share** = share of intervals with error > 0 / < 0.
- Energy totals in the UI: for hourly points, GWh = sum(MW × 1 h) / 1000,
  labelled as hourly-point energy.

## Files

```
.
├── README.md                  # this file
├── docker-compose.yml         # frontend + backend together
├── render.yaml                # Render backend blueprint (fallback)
├── backend/
│   ├── Dockerfile
│   ├── Procfile
│   ├── requirements.txt       # fastapi, uvicorn, pandas, numpy, httpx
│   ├── test_analysis.py       # synthetic cutoff test (no network)
│   ├── app/
│   │   ├── main.py            # FastAPI app + /api/* endpoints
│   │   ├── elexon.py          # BMRS client, chunked fetch, disk cache
│   │   └── analysis.py        # cutoff selection, dataset build, metrics
│   └── data_cache/
│       ├── actuals.json       # 1,488 FUELHH WIND rows, Jan 2026
│       └── forecasts.json     # 25,112 WINDFOR rows, Dec 2025–Feb 2026
├── frontend/
│   ├── Dockerfile             # build + nginx serve
│   ├── package.json
│   ├── vite.config.js
│   ├── api/                   # Vercel serverless API (same /api/* contract)
│   │   ├── data.json          # compact Jan 2026 snapshot
│   │   └── *.py               # health, config, forecast, metrics, coverage
│   └── src/                   # React app: Decision, Accuracy, Evolution, Method
└── docs/
    ├── DEPLOY.md              # deploy + submit checklist
    └── VIDEO-SCRIPT.md        # 10-minute demo script (5 min client + 5 min tech)
```

## API endpoints

| Endpoint | What it does |
|---|---|
| `GET /api/health` | `{"status": "ok"}` |
| `GET /api/config` | Cutoff hour, month, decision rule |
| `GET /api/coverage` | Raw actual/forecast/matched row counts |
| `GET /api/forecast?date=2026-01-15&cutoff_hour=9` | One day: metrics + interval points |
| `GET /api/metrics?cutoff_hour=9` | Overall + by-day + by-hour metrics |

Interactive docs (when the backend is running): http://localhost:8000/docs

## How to run

### Option A — Docker

```bash
docker compose up --build
# frontend: http://localhost:3000
# backend:  http://localhost:8000/api/health
```

### Option B — without Docker

```bash
# Backend
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
# On Windows, use .venv\Scripts\python.exe instead of .venv/bin/python

# Frontend (new terminal)
cd frontend
npm install
VITE_API_URL=http://localhost:8000 npm run dev
# frontend: http://localhost:5173
```

### Tests

```bash
cd backend
.venv/bin/python test_analysis.py
# Expected: OK — picks the 09:00 D-1 forecast, error -500 on the fixture
```

## Limitations and future work

- January 2026 only, GB national wind only, Elexon only.
- 24 matched points/day, for the hourly-vs-half-hourly reason above.
- No demand or price data, so no buy-quantity or cost recommendation.
- No authentication (public pilot demo) — add auth before any real
  production use.
- No intraday updates: this is a day-ahead analysis, not a live
  trading tool.
- Future work: demand + day-ahead prices (to turn error into £ risk),
  probabilistic forecast bands, intraday forecast revisions, and the
  alternative hourly-aggregation view for comparison.

## AI-tool disclosure

As the brief requires, this is stated clearly: **AI tools were used to
help build this application** — including domain research, planning,
code assistance, testing, and documentation. The core decision logic
(cutoff selection, no look-ahead bias), the metric definitions, and the
live-data verification were checked against real Elexon data, and the
synthetic cutoff test passes. No data, metric, or result in this README
was made up: every headline number above is computed by the backend
from the cached Elexon feeds and can be reproduced with
`GET /api/metrics`.
