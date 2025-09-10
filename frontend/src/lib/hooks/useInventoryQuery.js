import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'

function getApiBase() {
  const base = import.meta.env.VITE_API_URL || ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

async function fetchJson(path, { signal, onUnauthorized } = {}) {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const token = localStorage.getItem('auth_token')
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    signal
  })
  if (res.status === 401 || res.status === 403) {
    try { onUnauthorized && onUnauthorized() } catch {}
    throw new Error('Sesión expirada. Inicia sesión nuevamente.')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Error ${res.status}: ${text || res.statusText}`)
  }
  return res.json()
}

export function useInventorySummaryQuery() {
  const { logout } = useAuth?.() || { logout: null }

  const query = useQuery({
    queryKey: ['inventario', 'resumen'],
    queryFn: ({ signal }) =>
      fetchJson('/inventario/resumen', {
        signal,
        onUnauthorized: () => logout && logout()
      }),
    // Ensure it refreshes each time the page mounts
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    placeholderData: (prev) => prev
  })

  const data = Array.isArray(query.data) ? query.data : []
  return { ...query, data }
}
