// frontend/src/lib/api.js
import { useAuth } from '../contexts/AuthContext'

function normalizeBase(v) {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s || s === 'undefined' || s === 'null') return ''
  return s.replace(/\/+$/, '') // strip trailing slash
}

// Good defaults: use env when present, else fall back
const DEFAULT_BASE = import.meta.env.PROD
  ? 'https://demotextiles-api.onrender.com/api/v1' // your Render API
  : 'http://localhost:5000/api/v1'                 // local dev

export function useAuthedFetch() {
  const { token } = useAuth()

  async function authedFetch(path, init = {}) {
    const base = normalizeBase(import.meta?.env?.VITE_API_URL) || DEFAULT_BASE
    const url = `${base}${path.startsWith('/') ? '' : '/'}${path}`

    const headers = new Headers(init.headers || {})
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    return fetch(url, { ...init, headers, credentials: 'omit' })
  }

  return { authedFetch }
}
