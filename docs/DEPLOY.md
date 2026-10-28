# Deploy + submit checklist (the owner's steps)

> **Already deployed (2026-10-28):** the live app is up at
> https://uk-wind-forecast-tushars-projects-5ad452d1.vercel.app
> (Vercel project `uk-wind-forecast`, root directory `frontend/`).
> It serves the React frontend AND the API: `frontend/api/` holds
> Python serverless functions with the same contract as the FastAPI
> backend (`/api/health`, `/api/config`, `/api/forecast`, `/api/metrics`,
> `/api/coverage`), reading a compact January 2026 snapshot
> (`frontend/api/data.json`) generated from live Elexon data, so no
> separate Render/Heroku backend is needed for the live link. The
> steps below are kept as the fallback / re-deploy path and for the
> remaining owner steps (GitHub repo, video, form).

Everything below needs the owner's own accounts, so it is deliberately
left as a checklist rather than done from a shared machine. Estimated
time: 30–45 minutes, plus video recording time.

## 1. Create the anonymous GitHub repo (5 min)

Pick a fresh random name (for example `kjhwr` — do not reuse a name that
identifies you, and do not put your name in the repo, commits, or code).
Create it as **public**, empty (no README initialised by GitHub, to avoid
a merge conflict), then from the project folder:

```bash
git init
git add .
git commit -m "UK day-ahead wind forecast monitor, January 2026"
git branch -M main
git remote add origin https://github.com/<owner>/<random-name>.git
git push -u origin main
```

Check in an incognito window: the repo URL must open without signing in.

## 2. Deploy the backend (10 min)

Option A — Render (recommended, no credit card for the free tier):
use the `render.yaml` blueprint in this repo, or create a Web Service
manually from the `backend/` folder (Dockerfile included). Note its URL,
for example `https://wind-forecast-backend.onrender.com`, and check
`<backend-url>/api/health` returns `{"status": "ok"}` and
`<backend-url>/api/metrics` returns the January headline numbers
(MAE 2127.5, RMSE 2606.1, bias +1851.5).

Option B — Heroku: push only the `backend/` folder as its own app
(`git subtree push --prefix backend heroku main`) — the Procfile there
runs uvicorn on `$PORT`.

Free-tier note: Render free services sleep after inactivity, so the
first load after a pause can take ~30–60 seconds. Warm it up once
before recording the video and before submitting.

## 3. Deploy the frontend (10 min)

Vercel: import the same GitHub repo, set the root directory to
`frontend/`, and set the build environment variable
`VITE_API_URL` to the backend URL from step 2 **before** the build runs
(the API URL is baked in at build time). Redeploy after changing it.

Check in an incognito window: the Vercel URL must load the Decision
view with real January data (not a loading spinner, not a localhost
error). Switch the date to 1 January and to 15 January to confirm the
API is actually answering.

## 4. Record the video (script in docs/VIDEO-SCRIPT.md)

Record it yourself, in your own words — the evaluation starts with the
video, and it has to sound like you understand the cutoff rule, the
metrics, and the 24-points-per-day limitation. Two takes, each under
5 minutes, total under 10 minutes. Upload as **unlisted** on YouTube
and test the link in incognito.

## 5. Fill the form and re-verify (5 min)

Form: https://forms.cloud.microsoft/r/FTX6K2bbnUP
Submit exactly three links: the unlisted video, the public repo, and
the live app. After submitting, open each link again from the values
you typed (not from your history) in incognito, to catch copy-paste
errors. Then update the "Live app" line at the top of README.md with
the deployed URL and push that one-line change.
