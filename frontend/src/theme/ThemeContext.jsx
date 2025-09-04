import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { extendTheme } from '@chakra-ui/react'

const ThemeCtx = createContext(null)

// Opciones disponibles
const ACCENTS = ['teal','blue','green','purple','red','orange','cyan','pink']
const FONTS = ['Inter','System','Montserrat','Arial','Roboto']
const RADII = ['sm','md','lg','xl','2xl']

const defaultPrefs = {
  colorMode: 'light',
  accent: 'teal',
  font: 'Inter',
  uiScale: 1.0,
  radius: 'md'
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

export function ThemePrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem('theme_prefs')
      return raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs
    } catch { return defaultPrefs }
  })

  // Persistencia local
  useEffect(() => {
    localStorage.setItem('theme_prefs', JSON.stringify(prefs))
  }, [prefs])

  // Construir el theme dinámico
  const theme = useMemo(() => {
    const baseFont = prefs.font || 'Inter'
    const ui = clamp(Number(prefs.uiScale || 1), 0.85, 1.3)
    const radius = RADII.includes(prefs.radius) ? prefs.radius : 'md'
    const fonts = { heading: baseFont, body: baseFont }
    const radii = { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem' }

    // Escalado ligero de tipografías
    const fontSizes = {
      xs: `${Math.round(12*ui)}px`,
      sm: `${Math.round(14*ui)}px`,
      md: `${Math.round(16*ui)}px`,
      lg: `${Math.round(18*ui)}px`,
      xl: `${Math.round(20*ui)}px`,
      '2xl': `${Math.round(24*ui)}px`,
      '3xl': `${Math.round(28*ui)}px`
    }

    // ColorScheme por defecto para Button, etc., leyendo "accent"
    const components = {
      Button: { defaultProps: { colorScheme: prefs.accent || 'teal', borderRadius: radius } },
      Badge: { defaultProps: { colorScheme: prefs.accent || 'teal', borderRadius: radius } },
      Input: { baseStyle: { field: { borderRadius: radius } } },
      Select: { baseStyle: { field: { borderRadius: radius } } },
      Menu: { baseStyle: { list: { borderRadius: radius } } },
      Drawer: { baseStyle: { dialog: { borderRadius: radius } } },
      Card: { baseStyle: { container: { borderRadius: radius } } }
    }

    return extendTheme({
      config: {
        initialColorMode: (prefs.colorMode === 'dark') ? 'dark' : 'light',
        useSystemColorMode: false
      },
      fonts,
      radii,
      fontSizes,
      components
    })
  }, [prefs])

  function updatePrefs(next) {
    setPrefs(prev => ({ ...prev, ...next }))
  }

  // Recibir prefs desde backend al iniciar sesión
  function setPrefsFromServer(serverPrefs) {
    if (serverPrefs && typeof serverPrefs === 'object') {
      updatePrefs(serverPrefs)
    }
  }

  const value = useMemo(() => ({
    prefs, updatePrefs, theme, setPrefsFromServer,
    colorModeConfigScript: (prefs.colorMode === 'dark') ? 'dark' : 'light',
    ACCENTS, FONTS, RADII
  }), [prefs, theme])

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export function useThemePrefs() {
  return useContext(ThemeCtx)
}
