import { useState } from 'react'

const W = 720
const H = 300
const PAD = { top: 18, right: 16, bottom: 34, left: 58 }

function scale(value, min, max, size) {
  if (max === min) return size / 2
  return ((value - min) / (max - min)) * size
}

/** Forecast vs actual line chart with hover details. No chart library used. */
export function LineChart({ points }) {
  const [hover, setHover] = useState(null)
  const data = points.filter((p) => p.forecast !== null && p.actual !== null)
  if (data.length === 0) return <p className="muted">No matched forecast/actual points to chart.</p>

  const values = data.flatMap((p) => [p.forecast, p.actual])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const lo = Math.floor((min - (max - min) * 0.08) / 100) * 100
  const hi = Math.ceil((max + (max - min) * 0.08) / 100) * 100
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (v) => PAD.top + ih - scale(v, lo, hi, ih)
  const line = (key) => data.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')

  const hovered = hover !== null ? data[hover] : null
  const ticks = [lo, (lo + hi) / 2, hi]

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Line chart of forecast wind versus actual wind"
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="tick">{Math.round(t).toLocaleString()}</text>
          </g>
        ))}
        <path d={line('forecast')} className="line-forecast" fill="none" />
        <path d={line('actual')} className="line-actual" fill="none" />
        {data.map((p, i) => (
          <circle
            key={p.startTime}
            cx={x(i)}
            cy={y(p.actual)}
            r={hover === i ? 6 : 3}
            className="dot-actual"
            onMouseEnter={() => setHover(i)}
          >
            <title>{`${p.startTime.slice(11, 16)} UK — forecast ${Math.round(p.forecast)} MW, actual ${Math.round(p.actual)} MW, error ${Math.round(p.error)} MW`}</title>
          </circle>
        ))}
      </svg>
      <div className="legend">
        <span><i className="swatch sw-forecast" /> Forecast (decision point)</span>
        <span><i className="swatch sw-actual" /> Actual</span>
        <span className="muted">Hover a dot for exact values. Y-axis: MW.</span>
      </div>
      {hovered && (
        <p className="hover-box">
          {hovered.startTime.slice(11, 16)} UK · Forecast {Math.round(hovered.forecast).toLocaleString()} MW ·
          Actual {Math.round(hovered.actual).toLocaleString()} MW ·
          Error {Math.round(hovered.error).toLocaleString()} MW · Horizon {Number(hovered.horizon_h).toFixed(1)} h
        </p>
      )}
    </div>
  )
}

/** Vertical bar chart for a single non-negative metric (e.g. MAE by day). */
export function BarChart({ rows, labelKey, valueKey, valueLabel, format = (v) => Math.round(v).toLocaleString() }) {
  if (!rows || rows.length === 0) return <p className="muted">No data to chart.</p>
  const max = Math.max(...rows.map((r) => r[valueKey] || 0), 1)
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const bw = iw / rows.length
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart of ${valueLabel}`}>
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + ih} y2={PAD.top + ih} className="axis" />
        {rows.map((r, i) => {
          const h = scale(r[valueKey] || 0, 0, max, ih)
          const bx = PAD.left + i * bw + Math.max(1, bw * 0.15)
          return (
            <g key={r[labelKey]}>
              <rect x={bx} y={PAD.top + ih - h} width={Math.max(2, bw * 0.7)} height={h} className="bar" rx="2">
                <title>{`${r[labelKey]}: ${valueLabel} ${format(r[valueKey])}`}</title>
              </rect>
              {(rows.length <= 31) && i % 2 === 0 && (
                <text x={bx + bw * 0.35} y={H - 8} textAnchor="middle" className="tick small">
                  {String(r[labelKey]).slice(5)}
                </text>
              )}
            </g>
          )
        })}
        <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" className="tick">{format(max)}</text>
      </svg>
      <p className="muted small">Y-axis: {valueLabel}. Hover a bar for its value.</p>
    </div>
  )
}

/** Diverging vertical bars for signed values (e.g. bias by hour). */
export function DivergingBarChart({ rows, labelKey, valueKey, valueLabel }) {
  if (!rows || rows.length === 0) return <p className="muted">No data to chart.</p>
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r[valueKey] || 0)), 1)
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const mid = PAD.top + ih / 2
  const bw = iw / rows.length
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Diverging bar chart of ${valueLabel}`}>
        <line x1={PAD.left} x2={W - PAD.right} y1={mid} y2={mid} className="axis" />
        {rows.map((r, i) => {
          const v = r[valueKey] || 0
          const h = (Math.abs(v) / maxAbs) * (ih / 2)
          const bx = PAD.left + i * bw + Math.max(1, bw * 0.15)
          return (
            <g key={r[labelKey]}>
              <rect
                x={bx}
                y={v >= 0 ? mid - h : mid}
                width={Math.max(2, bw * 0.7)}
                height={h}
                className={v >= 0 ? 'bar-pos' : 'bar-neg'}
                rx="2"
              >
                <title>{`${r[labelKey]}: ${valueLabel} ${Math.round(v).toLocaleString()} MW`}</title>
              </rect>
              <text x={bx + bw * 0.35} y={H - 8} textAnchor="middle" className="tick small">{r[labelKey]}</text>
            </g>
          )
        })}
        <text x={PAD.left - 8} y={mid - 6} textAnchor="end" className="tick">0</text>
      </svg>
      <p className="muted small">
        Bars above the line = positive bias (over-forecast); below = negative bias (under-forecast). Y-axis: MW.
      </p>
    </div>
  )
}

/** Small diverging error bars for one day (one bar per interval). */
export function ErrorBarChart({ points }) {
  const data = points.filter((p) => p.error !== null && p.error !== undefined)
  if (data.length === 0) return <p className="muted">No errors to chart.</p>
  const maxAbs = Math.max(...data.map((p) => Math.abs(p.error)), 1)
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const mid = PAD.top + ih / 2
  const bw = iw / data.length
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Error per interval">
        <line x1={PAD.left} x2={W - PAD.right} y1={mid} y2={mid} className="axis" />
        {data.map((p, i) => {
          const h = (Math.abs(p.error) / maxAbs) * (ih / 2)
          const bx = PAD.left + i * bw + 1
          return (
            <rect
              key={p.startTime}
              x={bx}
              y={p.error >= 0 ? mid - h : mid}
              width={Math.max(2, bw - 2)}
              height={h}
              className={p.error >= 0 ? 'bar-pos' : 'bar-neg'}
            >
              <title>{`${p.startTime.slice(11, 16)} UK: error ${Math.round(p.error).toLocaleString()} MW`}</title>
            </rect>
          )
        })}
      </svg>
      <p className="muted small">
        Above the line = forecast higher than actual (over-forecast, shortfall risk). Below = forecast lower than actual.
      </p>
    </div>
  )
}
