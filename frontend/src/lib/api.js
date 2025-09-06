// frontend/src/lib/api.js
import { useCallback, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

function normalizeBase(raw) {
  if (!raw) return ''
  return String(raw).replace(/\/+$/, '')
}

export function detectApiBase() {
  const envBase = normalizeBase(import.meta.env.VITE_API_URL)
  // Fallback: if running on the deployed static site, prefer same-origin /api/v1
  const locBase =
    typeof window !== 'undefined' && window.location?.origin
      ? normalizeBase(window.location.origin) + '/api/v1'
      : ''

  // Local dev fallback
  const localBase = 'http://localhost:5000/api/v1'

  return envBase || locBase || localBase
}

export function useAuthedFetch() {
  const { token } = useAuth()
  const base = detectApiBase()

  useEffect(() => {
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === '1') {
      // Surface everything we need to know in the console
      console.log('[api] VITE_API_URL :', import.meta.env.VITE_API_URL)
      console.log('[api] computed base:', base)
      console.log('[api] location     :', typeof window !== 'undefined' ? window.location.href : '(no window)')
    }
    // also expose for quick inspection in DevTools
    if (typeof window !== 'undefined') {
      window.__API_DEBUG__ = { base, VITE_API_URL: import.meta.env.VITE_API_URL }
    }
  }, [base])

  const authedFetch = useCallback(
    async (path, opts = {}) => {
      if (!path || typeof path !== 'string' || path[0] !== '/') {
        throw new Error(`authedFetch: 'path' must start with '/'. Got: ${path}`)
      }
      const url = base + path
      const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) }
      if (token) headers.Authorization = `Bearer ${token}`

      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === '1') {
        console.log('[api] →', opts.method || 'GET', url, { headers, ...(opts || {}) })
      }

      const res = await fetch(url, {
        ...opts,
        headers,
        credentials: 'omit', // we use tokens, not cookies
      })

      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        const text = await res.text().catch(() => '')
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG === '1') {
          console.error('[api] Non-JSON response ←', {
            url,
            status: res.status,
            contentType: ct,
            bodyPreview: text.slice(0, 500),
          })
        }
        // Throw so callers can show a toast
        throw new Error(
          `Non-JSON response (${res.status}) from ${url}. ` +
            `content-type="${ct}". First 120 chars: ${text.slice(0, 120)}`
        )
      }

      if (!res.ok) {
        // Still try to parse JSON error payload
        let payload
        try {
          payload = await res.json()
        } catch {
          // fall back to text payload
          const text = await res.text().catch(() => '')
          if (import.meta.env.VITE_DEBUG === '1') {
            console.error('[api] Error JSON parse failed, raw text:', text.slice(0, 300))
          }
          throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 120)}`)
        }
        const msg = typeof payload?.error === 'string' ? payload.error : JSON.stringify(payload)
        throw new Error(`HTTP ${res.status} from ${url}: ${msg}`)
      }

      return res
    },
    [base, token]
  )

  return { authedFetch, apiBase: base }
}
