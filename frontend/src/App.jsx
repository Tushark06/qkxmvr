import { useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE, fetchConfig, fetchForecast, fetchHealth, fetchMetrics } from './api'
import { BarChart, DivergingBarChart, ErrorBarChart, LineChart } from './charts'
import { errorClass, fmtDateTimeUK, fmtNum, fmtTimeUK, sumGWh } from './format'
import './styles.css'

const CUTOFFS = [0, 6, 9, 12, 15, 18]
const TABS = [
  { id: 'decision', label: 'Decision view' },
  { id: 'accuracy', label: 'Accuracy dashboard' },
  { id: 'evolution', label: 'Forecast evolution' },
  { id: 'method', label: 'Method & limitations' },
]

function MetricCard({ label, value, unit, hint }) {
  return (
    <div className="card metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}<span className="unit">{unit ? ` ${unit}` : ''}</span></div>
      {hint && <div className="metric-hint">{hint}</div>}
    </div>
  )
}

function StatusBanner({ loading, error, empty }) {
  if (loading) return <div className="banner info" role="status">Loading data from the backend…</div>
  if (error) {
    return (
      <div className="banner error" role="alert">
        <strong>Could not load data.</strong>{' '}
        {error.status === 404
          ? 'No data for this date. Pick a delivery date in January 2026.'
          : error.status === 502
            ? 'The backend could not reach Elexon. Please try again in a minute.'
            : `${error.message}. Backend: ${API_BASE}`}
      </div>
    )
  }
  if (empty) return <div className="banner info">No matched points for this date and cutoff.</div>
  return null
}

function DecisionView({ date, setDate, cutoff, setCutoff, data, loading, error }) {
  const points = data?.points ?? []
  const m = data?.metrics ?? {}
  const worst = useMemo(
    () => [...points].filter((p) => p.error !== null).sort((a, b) => Math.abs(b.error) - Math.abs(a.error)).slice(0, 5),
    [points],
  )
  const worstTimes = new Set(worst.map((p) => p.startTime))

  return (
    <section>
      <div className="controls card">
        <label>
          Delivery date
          <input type="date" min="2026-01-01" max="2026-01-31" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Decision cutoff (D-1, UK time)
          <select value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))}>
            {CUTOFFS.map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </label>
        <p className="control-note">
          Rule: for delivery day {date}, each point uses the latest WINDFOR forecast published
          at or before {String(cutoff).padStart(2, '0')}:00 UK time on the previous day.
          Changing the cutoff refetches the data.
        </p>
      </div>

      <StatusBanner loading={loading} error={error} empty={!loading && !error && data && points.length === 0} />

      {data && (
        <>
          <div className="grid metrics-grid">
            <MetricCard label="Forecast energy (hourly points)" value={fmtNum(sumGWh(points, 'forecast'), 1)} unit="GWh" hint="Sum of hourly forecast MW × 1 h / 1000" />
            <MetricCard label="Actual energy (hourly points)" value={fmtNum(sumGWh(points, 'actual'), 1)} unit="GWh" hint="Sum of hourly actual MW × 1 h / 1000" />
            <MetricCard label="MAE" value={fmtNum(m.mae, 1)} unit="MW" hint="Typical absolute error" />
            <MetricCard label="RMSE" value={fmtNum(m.rmse, 1)} unit="MW" hint="Large errors count more" />
            <MetricCard label="Bias" value={m.bias > 0 ? `+${fmtNum(m.bias, 1)}` : fmtNum(m.bias, 1)} unit="MW" hint="+ = over-forecast = shortfall risk" />
            <MetricCard label="Matched points" value={fmtNum(m.n)} unit="" hint="24 hourly points expected per day" />
          </div>

          <p className="muted">
            Latest forecast publish time in this day's decision set: <strong>{fmtDateTimeUK(data.forecast_published_max)}</strong>.
            Note: this is the newest publish time among the selected points, not necessarily a single forecast run.
          </p>

          <div className="card">
            <h2>Forecast vs actual — {date}</h2>
            <LineChart points={points} />
          </div>

          <div className="card">
            <h2>Error per interval — {date}</h2>
            <ErrorBarChart points={points} />
          </div>

          {worst.length > 0 && (
            <div className="card">
              <h2>Largest errors today</h2>
              <ul>
                {worst.map((p) => (
                  <li key={p.startTime}>
                    {fmtTimeUK(p.startTime)} UK — error {Math.round(p.error).toLocaleString()} MW
                    (forecast {fmtNum(p.forecast)} MW, actual {fmtNum(p.actual)} MW)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card table-wrap">
            <h2>Interval table — 24 hourly points</h2>
            <p className="muted small">
              WINDFOR is hourly and FUELHH is half-hourly, so exact startTime matching gives 24 points per day (744 in January),
              not 48. Half-hourly actuals that have no hourly forecast startTime are not shown here.
            </p>
            <table>
              <thead>
                <tr><th>Time (UK)</th><th>Forecast published</th><th>Forecast (MW)</th><th>Actual (MW)</th><th>Error (MW)</th><th>Horizon (h)</th></tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.startTime} className={worstTimes.has(p.startTime) ? 'worst' : ''}>
                    <td>{fmtTimeUK(p.startTime)}</td>
                    <td>{fmtDateTimeUK(p.publishTime)}</td>
                    <td>{fmtNum(p.forecast)}</td>
                    <td>{fmtNum(p.actual)}</td>
                    <td className={errorClass(p.error)}>{p.error === null ? '—' : `${p.error > 0 ? '+' : ''}${fmtNum(p.error)}`}</td>
                    <td>{p.horizon_h === null ? '—' : Number(p.horizon_h).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">Highlighted rows are the 5 largest absolute errors for this day. Error = forecast − actual.</p>
          </div>
        </>
      )}
    </section>
  )
}

function AccuracyView({ cutoff, setCutoff, data, loading, error }) {
  const overall = data?.overall ?? {}
  const byDay = data?.by_day ?? []
  const byHour = data?.by_hour ?? []
  return (
    <section>
      <div className="controls card">
        <label>
          Decision cutoff (D-1, UK time)
          <select value={cutoff} onChange={(e) => setCutoff(Number(e.target.value))}>
            {CUTOFFS.map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
            ))}
          </select>
        </label>
        <p className="control-note">All metrics below use the decision rule at this cutoff. Error = forecast − actual (MW).</p>
      </div>

      <StatusBanner loading={loading} error={error} empty={!loading && !error && data && overall.n === 0} />

      {data && overall.n > 0 && (
        <>
          <div className="grid metrics-grid">
            <MetricCard label="MAE — January" value={fmtNum(overall.mae, 1)} unit="MW" hint="Typical absolute error" />
            <MetricCard label="RMSE — January" value={fmtNum(overall.rmse, 1)} unit="MW" hint="Punishes large errors" />
            <MetricCard label="Bias — January" value={overall.bias > 0 ? `+${fmtNum(overall.bias, 1)}` : fmtNum(overall.bias, 1)} unit="MW" hint="+ = systematic over-forecast" />
            <MetricCard label="nMAE" value={fmtNum(overall.nmae_pct, 1)} unit="%" hint="MAE as % of mean actual" />
            <MetricCard label="MAPE" value={fmtNum(overall.mape, 1)} unit="%" hint="Mean % error where actual > 0" />
            <MetricCard label="P90 absolute error" value={fmtNum(overall.p90_abs_error, 1)} unit="MW" hint="90% of errors are at or below this" />
            <MetricCard label="Max absolute error" value={fmtNum(overall.max_abs_error, 1)} unit="MW" hint="Worst single hourly point" />
            <MetricCard label="Matched points" value={fmtNum(overall.n)} unit="" hint="744 expected for January (24 × 31)" />
          </div>

          <div className="card explain">
            <h2>How to read these numbers, in plain English</h2>
            <p><strong>MAE</strong> is the everyday answer: on a typical hourly point, the forecast was about this far off, ignoring direction.</p>
            <p><strong>RMSE</strong> is the risk answer: because errors are squared first, a few very large misses push RMSE above MAE. If RMSE is much larger than MAE, the problem is occasional big misses, not steady small ones.</p>
            <p><strong>Bias</strong> is the direction answer: a positive bias means the forecast systematically says more wind than arrives. For a buyer, that is shortfall risk — power that must be bought later, often urgently. A negative bias means systematic over-buying.</p>
            <p><strong>P90 absolute error</strong> is the planning answer: use it, not the average, when sizing a safety margin. Nine times out of ten, the error was no bigger than this.</p>
          </div>

          <div className="card">
            <h2>MAE by delivery day</h2>
            <BarChart rows={byDay} labelKey="delivery_date" valueKey="mae" valueLabel="MAE (MW)" />
          </div>

          <div className="card table-wrap">
            <h2>Daily breakdown</h2>
            <table>
              <thead><tr><th>Date</th><th>n</th><th>MAE (MW)</th><th>RMSE (MW)</th><th>Bias (MW)</th><th>Mean actual (MW)</th></tr></thead>
              <tbody>
                {byDay.map((d) => (
                  <tr key={d.delivery_date}>
                    <td>{d.delivery_date}</td><td>{d.n}</td><td>{fmtNum(d.mae, 1)}</td><td>{fmtNum(d.rmse, 1)}</td>
                    <td className={errorClass(d.bias)}>{d.bias > 0 ? `+${fmtNum(d.bias, 1)}` : fmtNum(d.bias, 1)}</td><td>{fmtNum(d.mean_actual, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2>Bias by hour of day (UK)</h2>
            <DivergingBarChart rows={byHour} labelKey="hour" valueKey="bias" valueLabel="Bias (MW)" />
            <p className="muted small">If bias is positive in evening hours, the shortfall risk is concentrated when demand is typically highest — but this app has no demand data, so that is a hypothesis to check, not a conclusion.</p>
          </div>

          <div className="card table-wrap">
            <h2>Hourly breakdown</h2>
            <table>
              <thead><tr><th>Hour (UK)</th><th>n</th><th>MAE (MW)</th><th>RMSE (MW)</th><th>Bias (MW)</th></tr></thead>
              <tbody>
                {byHour.map((d) => (
                  <tr key={d.hour}>
                    <td>{String(d.hour).padStart(2, '0')}:00</td><td>{d.n}</td><td>{fmtNum(d.mae, 1)}</td><td>{fmtNum(d.rmse, 1)}</td>
                    <td className={errorClass(d.bias)}>{d.bias > 0 ? `+${fmtNum(d.bias, 1)}` : fmtNum(d.bias, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function EvolutionView({ date, setDate, cutoff, data }) {
  const points = data?.points ?? []
  const [selected, setSelected] = useState('')
  useEffect(() => {
    if (points.length > 0 && !points.some((p) => p.startTime === selected)) {
      setSelected(points[Math.floor(points.length / 2)].startTime)
    }
  }, [points, selected])
  const point = points.find((p) => p.startTime === selected)

  return (
    <section>
      <div className="controls card">
        <label>
          Delivery date
          <input type="date" min="2026-01-01" max="2026-01-31" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <p className="control-note">
          Pick a date, then pick one hourly point below. This page deliberately does <strong>not</strong> draw a fake revision curve.
        </p>
      </div>

      {points.length > 0 ? (
        <>
          <label className="card block-label">
            Hourly point
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {points.map((p) => (
                <option key={p.startTime} value={p.startTime}>{fmtTimeUK(p.startTime)} UK</option>
              ))}
            </select>
          </label>

          {point && (
            <div className="card">
              <h2>Decision point — {date} at {fmtTimeUK(point.startTime)} UK</h2>
              <dl className="facts">
                <div><dt>Decision cutoff</dt><dd>D-1 at {String(cutoff).padStart(2, '0')}:00 UK</dd></div>
                <div><dt>Forecast used</dt><dd>{fmtNum(point.forecast)} MW, published {fmtDateTimeUK(point.publishTime)}</dd></div>
                <div><dt>Actual outturn</dt><dd>{fmtNum(point.actual)} MW</dd></div>
                <div><dt>Error</dt><dd className={errorClass(point.error)}>{point.error > 0 ? '+' : ''}{fmtNum(point.error)} MW</dd></div>
                <div><dt>Horizon</dt><dd>{Number(point.horizon_h).toFixed(1)} hours from publish time to delivery</dd></div>
              </dl>
              <p>
                The horizon is the key context: this forecast was made {Number(point.horizon_h).toFixed(1)} hours before delivery.
                A forecast made closer to delivery usually has less time for the weather outlook to change, but this single point alone cannot prove that —
                compare horizons across days on the Accuracy dashboard instead.
              </p>
            </div>
          )}

          <div className="card">
            <h2>Why there is no revision curve here</h2>
            <p>
              A true revision history would show, for this one startTime, every WINDFOR forecast published over successive days and how the
              forecast value moved. The backend API used by this frontend returns only the single decision point (the latest forecast at or before
              the cutoff), not the full revision list. Drawing a curve from one point would be invented data.
            </p>
            <p>
              To add this honestly, the backend would need a revisions endpoint that groups the raw WINDFOR feed by startTime and returns all
              publishTimes and values for that startTime. That is listed as a v2 item on the Method page. Until then, this page shows exactly what
              the decision-maker had, and says so.
            </p>
          </div>
        </>
      ) : (
        <div className="banner info">Load a decision day first (Decision view), or pick a January 2026 date above.</div>
      )}
    </section>
  )
}

function MethodView() {
  return (
    <section>
      <div className="card">
        <h2>Decision rule</h2>
        <p>
          For delivery day D, a purchase decision is made on D-1 at the chosen cutoff hour (UK time; default 09:00).
          For each delivery point, the app uses the latest forecast with publishTime at or before that cutoff.
          Forecasts published after the cutoff are never used for that day's decision view, even if they turned out more accurate.
          That is how look-ahead bias is avoided.
        </p>
        <p>
          January 2026 only. GB national wind only. No other data is used.
        </p>
      </div>

      <div className="card">
        <h2>Metric formulas</h2>
        <p>For each matched point, error e = forecast − actual, in MW.</p>
        <ul>
          <li><strong>MAE</strong> = mean(|e|)</li>
          <li><strong>RMSE</strong> = √mean(e²)</li>
          <li><strong>Bias (mean error)</strong> = mean(e); positive = over-forecast</li>
          <li><strong>nMAE</strong> = MAE / mean(actual) × 100</li>
          <li><strong>MAPE</strong> = mean(|e| / actual) × 100, over points where actual &gt; 0</li>
          <li><strong>P90 absolute error</strong> = 90th percentile of |e|</li>
        </ul>
      </div>

      <div className="card">
        <h2>Hourly vs half-hourly — read this before quoting "48 intervals"</h2>
        <p>
          FUELHH actuals are half-hourly: 48 slots per day, 1,488 slots in January 2026, and actuals coverage for this build is 1,488/1,488.
          WINDFOR forecasts in this feed are hourly. The backend matches on exact startTime, so only 24 points per day match — 744 matched
          points for January. The other half-hourly actuals exist, but they have no hourly forecast startTime to pair with, so they are not
          counted in forecast accuracy. Energy totals on the Decision page are therefore hourly-point energy (MW × 1 h / 1000), not
          half-hourly energy.
        </p>
      </div>

      <div className="card">
        <h2>What this app does not do</h2>
        <ul>
          <li>No demand data, so it cannot recommend a buy quantity in MW or MWh. It quantifies wind error only.</li>
          <li>No price data, so it cannot put a £ cost on an error.</li>
          <li>No trading execution and no new wind forecast of its own — it evaluates Elexon's forecasts.</li>
          <li>No login or user accounts in this pilot version.</li>
        </ul>
      </div>

      <div className="card">
        <h2>Data sources</h2>
        <ul>
          <li><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">Elexon BMRS — FUELHH (actual generation by fuel type)</a></li>
          <li><a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">Elexon BMRS — WINDFOR (wind generation forecast)</a></li>
        </ul>
        <p className="muted small">Filter: fuelType = WIND. Scope: delivery dates 1–31 January 2026, Great Britain national level.</p>
      </div>

      <div className="card">
        <h2>What v2 would add</h2>
        <ul>
          <li>A revisions endpoint and a true forecast-evolution curve per startTime.</li>
          <li>Error breakdown by forecast horizon bucket.</li>
          <li>Demand and day-ahead price data, so wind error can be translated into a buy quantity and a cost — only with those sources added explicitly.</li>
          <li>Half-hourly forecast handling if a half-hourly forecast feed becomes available, so all 1,488 actual slots can be matched.</li>
        </ul>
      </div>
    </section>
  )
}

export default function App() {
  const [tab, setTab] = useState('decision')
  const [date, setDate] = useState('2026-01-15')
  const [cutoff, setCutoff] = useState(9)
  const [config, setConfig] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState(null)
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetchConfig().then((c) => { setConfig(c); if (c.cutoff_hour_uk !== undefined) setCutoff(c.cutoff_hour_uk) }).catch(() => {})
    fetchHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  const loadForecast = useCallback(async () => {
    if (!date) return
    setLoading(true); setError(null)
    try { setForecast(await fetchForecast(date, cutoff)) }
    catch (e) { setForecast(null); setError(e) }
    finally { setLoading(false) }
  }, [date, cutoff])

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true); setMetricsError(null)
    try { setMetrics(await fetchMetrics(cutoff)) }
    catch (e) { setMetrics(null); setMetricsError(e) }
    finally { setMetricsLoading(false) }
  }, [cutoff])

  useEffect(() => { loadForecast() }, [loadForecast])
  useEffect(() => { if (tab === 'accuracy') loadMetrics() }, [tab, loadMetrics])

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1>UK Wind Forecast — Day-Ahead Decisions</h1>
            <p>GB national wind · January 2026 · Elexon FUELHH actuals + WINDFOR forecasts</p>
          </div>
          <div className="header-status">
            <span className={health ? 'dot-ok' : 'dot-unknown'} /> {health ? 'Backend OK' : 'Backend status unknown'}
            {config && <span className="muted small"> · Default cutoff D-1 {String(config.cutoff_hour_uk).padStart(2, '0')}:00 UK</span>}
          </div>
        </div>
        <nav className="tabs" aria-label="Pages">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>

      <main className="main">
        <p className="scope-note">
          Decision support only. This app evaluates wind forecasts; it does not place trades and, without demand or price data,
          it does not recommend a buy quantity.
        </p>
        {tab === 'decision' && <DecisionView date={date} setDate={setDate} cutoff={cutoff} setCutoff={setCutoff} data={forecast} loading={loading} error={error} />}
        {tab === 'accuracy' && <AccuracyView cutoff={cutoff} setCutoff={setCutoff} data={metrics} loading={metricsLoading} error={metricsError} />}
        {tab === 'evolution' && <EvolutionView date={date} setDate={setDate} cutoff={cutoff} data={forecast} />}
        {tab === 'method' && <MethodView />}
      </main>

      <footer className="footer">
        <p>Sources: Elexon BMRS FUELHH and WINDFOR. Scope: January 2026, GB national wind only. Error = forecast − actual (MW).</p>
        <p className="muted small">Backend: {API_BASE}</p>
      </footer>
    </div>
  )
}
