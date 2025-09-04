import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useThemePrefs } from '../theme/ThemeContext'

const AuthCtx = createContext(null)
const API_BASE = import.meta.env.VITE_API_BASE_URL

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('auth_token') || '')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  })
  const { setPrefsFromServer } = useThemePrefs()

  const isAuthenticated = !!token

  useEffect(() => {
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }, [token])

  useEffect(() => {
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('auth_user')
    }
  }, [user])

  async function login(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) {
      const data = await res.json().catch(()=>({}))
      throw new Error(data.error || 'Error al iniciar sesión')
    }
    const data = await res.json()
    setToken(data.token)
    setUser(data.user)
    setPrefsFromServer(data.prefs || {})
    return data
  }

  function logout() {
    setToken('')
    setUser(null)
  }

  const value = useMemo(() => ({
    token, user, isAuthenticated, login, logout
  }), [token, user, isAuthenticated])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  return useContext(AuthCtx)
}
