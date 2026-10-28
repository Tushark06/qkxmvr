# Frontend — UK Wind Forecast (January 2026)

## What was built

Vite + React (plain JavaScript) single-page app with four tabs and custom SVG
charts (no chart library was added, to avoid dependency risk):

1. **Decision view (default)** — delivery date picker limited to
   2026-01-01…2026-01-31, D-1 cutoff selector (00:00, 06:00, 09:00, 12:00,
   15:00, 18:00 UK), summary cards, forecast-vs-actual line chart, error-per-interval
   bars, 5 largest errors, and a 24-row interval table.
2. **Accuracy dashboard** — overall MAE / RMSE / bias / nMAE / MAPE / P90 /
   max-error cards, plain-English explanations, MAE by day (bar chart + table),
   bias by hour (diverging bar chart + table).
3. **Forecast evolution** — pick a date and one hourly point; shows that
   point's decision forecast, publish time, actual, error and horizon. It
   deliberately does **not** draw a revision curve: the backend returns only
   the decision point, so a revision series would be invented data.
4. **Method & limitations** — decision rule, metric formulas, the
   hourly-vs-half-hourly fact, what the app does not do, data sources, v2 items.

Honest facts shown in the UI:

- January 2026 only, GB national wind only, Elexon FUELHH actuals +
  WINDFOR forecasts.
- Decision rule: latest forecast published at or before D-1 cutoff (UK time).
- WINDFOR is hourly and FUELHH is half-hourly; exact startTime matching gives
  **24 points/day (744 in January), not 48**. Actuals coverage is 1488/1488
  half-hourly slots; unmatched half-hourly actuals are not counted in accuracy.
- Energy totals on the Decision page are hourly-point energy
  (sum of MW × 1 h / 1000), labelled as such.
- Error = forecast − actual (MW). Positive bias = systematic over-forecast =
  shortfall risk.
- No demand or price data, so no buy-quantity or cost recommendation is made.

## How to run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Backend URL comes from `VITE_API_URL` (a `.env` file or shell env), defaulting
to `http://localhost:8000`. Example:

```bash
VITE_API_URL=http://localhost:8000 npm run dev
# or: echo "VITE_API_URL=http://localhost:8000" > .env
```

Production build:

```bash
npm run build      # output in dist/
npm run preview    # serve the built app locally
```

## Backend contract used

Base URL: `VITE_API_URL` (default `http://localhost:8000`).

- `GET /api/health` → `{status}`
- `GET /api/config` → `{cutoff_hour_uk, month, rule}`
- `GET /api/forecast?date=YYYY-MM-DD&cutoff_hour=9` → date, cutoff, latest
  publish time, metrics, and `points[]` with startTime, publishTime, forecast,
  actual, error, horizon_h.
- `GET /api/metrics?cutoff_hour=9` → overall metrics, by_day, by_hour.

Loading, empty (404 date) and API-error states are shown visibly in the UI.
No login/auth is implemented, per the brief for this pilot.
