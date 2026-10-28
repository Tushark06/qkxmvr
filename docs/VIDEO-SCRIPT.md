# Video script — max 10 minutes, unlisted YouTube

Record in two separate takes so each part stays under 5 minutes.
Show the live app, not slides alone. Speak in your own words — do not
read this verbatim if it sounds unnatural; hit the beats, in order.

## Part 1 — Client pitch (0:00–5:00)

- 0:00 Problem in one sentence: "You buy tomorrow's power today, but wind
  is the one part you cannot control — so your forecast error is your
  buying risk."
- 0:45 Decision view, live: pick 15 January 2026, cutoff D-1 09:00.
  Point at the forecast line vs the actual line, and the day's MAE
  (1,025 MW) and bias (all 24 intervals over-forecast that day).
- 2:15 Accuracy dashboard, January headline: MAE 2,127.5 MW, RMSE
  2,606.1 MW, bias +1,851.5 MW, over-forecast on 84.8% of intervals.
  Translate it: "At 09:00, the forecast typically overstated wind, so an
  unadjusted plan would typically leave you short."
- 3:30 Why the cutoff matters: show the rule in plain English — only
  forecasts published before D-1 09:00 are used. A later, better forecast
  is not allowed to rewrite a decision already taken.
- 4:30 Honest limits + next step: January only, wind only, no demand or
  prices, so this sizes the margin, it does not place the order. V2:
  demand and prices to turn MW error into money risk.
- 4:50 Close: "This is a pilot you can open in a browser today — no
  install, real January data."

## Part 2 — Tech-lead review (0:00–5:00)

- 0:00 Architecture: React (Vite) frontend → FastAPI backend → Elexon
  BMRS (FUELHH + WINDFOR) → disk cache → computed dataset. Docker
  Compose reproduces both services locally.
- 1:00 Ingestion: chunked fetches (3-day windows), disk cache so the demo
  does not depend on live rate limits (429 handling), 1,488 actuals and
  25,112 forecasts fetched for January.
- 2:00 Core algorithm + tests: `select_decision_forecast` groups by
  startTime, filters publishTime <= D-1 09:00 UK time, takes the latest.
  Show `test_analysis.py` passing, and the 10 January example (07:30
  forecast picked, 09:30 forecast correctly excluded).
- 3:00 Metrics + the 24/day fact: MAE/RMSE/bias/MAPE/nMAE/P90 defined in
  README; WINDFOR is hourly while FUELHH is half-hourly, so exact
  matching gives 24 points/day, 744 total — stated, not hidden.
- 4:00 Repo tour + run: show the file tree, `docker compose up`,
  `/api/metrics` and Swagger at /docs, frontend tabs (Decision, Accuracy,
  Evolution, Method).
- 4:45 Risks + what I would change with more time: hourly aggregation
  comparison view, demand/price join, auth, intraday revisions.

## Recording checklist

- [ ] Live app open, backend already warmed up (first fetch takes ~40 s;
  with the shipped cache it is instant — do not record a cold fetch).
- [ ] Show one good day (15 Jan) and one bad day (1 Jan, MAE 4,223 MW).
- [ ] Keep each part under 5:00; total under 10:00.
- [ ] Upload as **unlisted**, test the link in an incognito window.
- [ ] Put the video link, repo link, and live app link in the submission
  form only after all three open in incognito.
