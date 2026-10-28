// VITE_API_URL unset -> localhost backend (local dev).
// VITE_API_URL="/" -> same-origin API (Vercel deployment, /api/* on the same host).
// Any other value -> that backend URL.
const _raw = import.meta.env.VITE_API_URL
export const API_BASE = _raw === undefined ? 'http://localhost:8000' : _raw.replace(/\/$/, '')

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body.detail || body.message || ''
    } catch {
      // keep HTTP status as the message
    }
    const err = new Error(detail || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const fetchConfig = () => getJson('/api/config')
export const fetchForecast = (date, cutoffHour) =>
  getJson(`/api/forecast?date=${encodeURIComponent(date)}&cutoff_hour=${cutoffHour}`)
export const fetchMetrics = (cutoffHour) =>
  getJson(`/api/metrics?cutoff_hour=${cutoffHour}`)
export const fetchHealth = () => getJson('/api/health')
