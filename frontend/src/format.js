export function fmtNum(v, digits = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return Number(v).toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

// January 2026 is GMT in the UK, so UTC clock time equals UK clock time.
// Times are still labelled "UK" rather than converted in the browser, so a
// viewer's local timezone cannot silently shift the trading day.
export function fmtTimeUK(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toISOString().slice(11, 16)
}

export function fmtDateTimeUK(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UK`
}

export function sumGWh(points, key) {
  // Hourly points only: each point represents 1 hour, so energy = MW x 1h / 1000.
  // This is labelled "hourly-point energy" in the UI, not half-hourly energy.
  return points.reduce((s, p) => s + (p[key] ?? 0) / 1000, 0)
}

export function errorClass(e) {
  if (e === null || e === undefined) return ''
  if (e > 0) return 'err-pos'
  if (e < 0) return 'err-neg'
  return ''
}
