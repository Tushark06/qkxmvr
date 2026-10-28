"""Vercel adapter: same contract as the FastAPI backend endpoint."""

import json, math, os
from datetime import datetime
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
_CACHE = None
def _parse(t):
    return datetime.fromisoformat(t.replace("Z", "+00:00"))
def load(cutoff):
    global _CACHE
    if _CACHE is None:
        here = os.path.dirname(os.path.abspath(__file__))
        with open(os.path.join(here, "data.json")) as f:
            _CACHE = json.load(f)
    key = str(cutoff)
    if key not in _CACHE["days"]:
        key = "9"
    hours = _CACHE["hours"][key]
    rows = []
    for date in sorted(_CACHE["days"][key]):
        pub, vals = _CACHE["days"][key][date]
        for i, h in enumerate(hours):
            fc, ac = vals[2*i], vals[2*i+1]
            st = "%sT%02d:00:00Z" % (date, h)
            rows.append({"startTime": st, "publishTime": pub, "forecast": fc, "actual": ac,
                         "error": fc - ac, "horizon_h": (_parse(st) - _parse(pub)).total_seconds() / 3600,
                         "delivery_date": date, "hour": h})
    return rows
def _pct(v, p):
    if not v: return None
    k = (len(v) - 1) * p / 100.0
    lo, hi = int(math.floor(k)), int(math.ceil(k))
    return v[lo] if lo == hi else v[lo] * (hi - k) + v[hi] * (k - lo)
def metrics(rows):
    d = [r for r in rows if r.get("actual") is not None and r.get("forecast") is not None]
    if not d: return {"n": 0}
    errs = [r["forecast"] - r["actual"] for r in d]
    ae = sorted(abs(e) for e in errs)
    mean_actual = sum(r["actual"] for r in d) / len(d)
    nz = [(abs(r["forecast"] - r["actual"]), r["actual"]) for r in d if r["actual"] > 0]
    return {"n": len(d), "mae": round(sum(ae)/len(ae), 1),
            "rmse": round(math.sqrt(sum(e*e for e in errs)/len(errs)), 1),
            "bias": round(sum(errs)/len(errs), 1),
            "overforecast_pct": round(sum(1 for e in errs if e > 0)/len(errs)*100, 1),
            "underforecast_pct": round(sum(1 for e in errs if e < 0)/len(errs)*100, 1),
            "mape": round(sum(a/b for a, b in nz)/len(nz)*100, 1) if nz else None,
            "nmae_pct": round((sum(ae)/len(ae))/mean_actual*100, 1) if mean_actual else None,
            "p90_abs_error": round(_pct(ae, 90), 1), "max_abs_error": round(max(ae), 1),
            "mean_actual": round(mean_actual, 1)}
def point(r):
    return {"startTime": r["startTime"], "publishTime": r["publishTime"], "forecast": r["forecast"],
            "actual": r["actual"], "error": r["error"], "horizon_h": r["horizon_h"]}
def cutoff_of(query):
    try: return int(query.get("cutoff_hour", ["9"])[0])
    except (ValueError, TypeError): return 9
def handle_query(query):
    return 200, {"status": "ok"}

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        try: status, payload = handle_query(q)
        except Exception as exc: status, payload = 500, {"detail": str(exc)}
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *args): pass
