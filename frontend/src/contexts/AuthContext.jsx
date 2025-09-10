import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useThemePrefs } from '../theme/ThemeContext'
import { queryClient } from '../lib/queryClient'


const AuthCtx = createContext(null)
const API_BASE = import.meta.env.VITE_API_URL

export function AuthProvider({ children }) {
  // Boot from sessionStorage first (short-lived), then localStorage (persistent)
  const initialToken =
    (typeof window !== 'undefined' && sessionStorage.getItem('auth_token')) ||
    (typeof window !== 'undefined' && localStorage.getItem('auth_token')) ||
    ''

  const initialUser = (() => {
    if (typeof window === 'undefined') return null
    const rawSession = sessionStorage.getItem('auth_user')
    const rawLocal = localStorage.getItem('auth_user')
    try {
      return rawSession ? JSON.parse(rawSession) : (rawLocal ? JSON.parse(rawLocal) : null)
    } catch {
      return null
    }
  })()

  const [token, setToken] = useState(initialToken)
  const [user, setUser] = useState(initialUser)
  const { setPrefsFromServer } = useThemePrefs()
  const isAuthenticated = !!token

  // Persist changes to both storages according to where they currently live
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Clear both, then (re)write to the correct place (session if it was a session login)
    sessionStorage.removeItem('auth_token')
    sessionStorage.removeItem('auth_user')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    if (token && user) {
      // If the token originally came from sessionStorage, keep session scope; else persist
      const cameFromSession =
        !!(typeof window !== 'undefined' && sessionStorage.getItem('__session_mode') === '1')
      const store = cameFromSession ? sessionStorage : localStorage
      store.setItem('auth_token', token)
      store.setItem('auth_user', JSON.stringify(user))
    }
  }, [token, user])

  // Login now accepts options: { remember: boolean }
  async function login(email, password, options = {}) {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Error al iniciar sesión')
    }
    const data = await res.json()
    setToken(data.token)
    setUser(data.user)
    setPrefsFromServer(data.prefs || {})

    // Mark where we should persist this session (session vs. persistent)
    if (typeof window !== 'undefined') {
      const remember = !!options.remember
      if (remember) {
        localStorage.setItem('__session_mode', '0')
      } else {
        sessionStorage.setItem('__session_mode', '1')
        localStorage.removeItem('__session_mode')
      }
    }
    return data
  }

  function logout() {
    // Reset in-memory auth state first so UI reacts immediately
    setToken('')
    setUser(null)

    // Clear persisted state in both storages (handles either session/local mode)
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('auth_token')
        sessionStorage.removeItem('auth_user')
        sessionStorage.removeItem('__session_mode')
      } catch {}
      try {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        localStorage.removeItem('__session_mode')
      } catch {}
    }

    // Purge all cached queries/mutations to avoid data leakage across sessions
    try {
      queryClient.clear()
    } catch {}
  }


  const value = useMemo(() => ({
    token, user, isAuthenticated, login, logout
  }), [token, user, isAuthenticated])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}


export function useAuth() {
  return useContext(AuthCtx)
}