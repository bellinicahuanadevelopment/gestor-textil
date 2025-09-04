import { useAuth } from '../contexts/AuthContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL

export function useAuthedFetch() {
  const { token } = useAuth()
  async function authedFetch(path, options = {}) {
    const headers = new Headers(options.headers || {})
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    return res
  }
  return { authedFetch }
}

export function useAuthedFetchJson() {
  const { authedFetch } = useAuthedFetch()
  async function authedFetchJson(path, options = {}) {
    const res = await authedFetch(path, options)
    const data = await res.json().catch(()=> ({}))
    if (!res.ok) {
      const msg = data?.error || 'Error de servidor'
      throw new Error(msg)
    }
    return data
  }
  return useAuthedFetchJson
}
