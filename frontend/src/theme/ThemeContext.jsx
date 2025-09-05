import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { extendTheme } from '@chakra-ui/react'
import { mode } from '@chakra-ui/theme-tools'

const ThemeCtx = createContext(null)

// Accent palette used across the app
export const ACCENTS = ['teal','blue','green','purple','red','orange','cyan','pink']

// Font options (restricted)
export const FONT_OPTIONS = [
  {
    id: 'Inter',
    label: 'Inter',
    stack: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
  },
  {
    id: 'Outfit',
    label: 'Outfit',
    stack: "'Outfit', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
  },
  {
    id: 'Geist',
    label: 'Geist',
    // falls back gracefully if Geist is not locally available
    stack: "'Geist', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
  },
  {
    id: 'Figtree',
    label: 'Figtree',
    stack: "'Figtree', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'"
  }
]

// Legacy export (if any code still reads FONTS, it will get the ids above)
export const FONTS = FONT_OPTIONS.map(f => f.id)

export const RADII = ['sm','md','lg','xl','2xl']

function stackFor(id) {
  return FONT_OPTIONS.find(f => f.id === id)?.stack || FONT_OPTIONS[0].stack
}

const defaultPrefs = {
  colorMode: 'light',
  accent: 'teal',
  font: 'Inter',
  fontStack: stackFor('Inter'),
  uiScale: 1.0,
  radius: 'md'
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)) }

export function ThemePrefsProvider({ children }) {
  const [prefs, setPrefsState] = useState(() => {
    try {
      const raw = localStorage.getItem('theme_prefs')
      const merged = raw ? { ...defaultPrefs, ...JSON.parse(raw) } : defaultPrefs
      // ensure we always have a valid stack even for older saved prefs
      return { ...merged, fontStack: stackFor(merged.font) }
    } catch { return defaultPrefs }
  })

  useEffect(() => {
    localStorage.setItem('theme_prefs', JSON.stringify(prefs))
  }, [prefs])

  const theme = useMemo(() => {
    const ui = clamp(Number(prefs.uiScale || 1), 0.85, 1.3)
    const radiusKey = RADII.includes(prefs.radius) ? prefs.radius : 'md'

    const fonts = { heading: prefs.fontStack, body: prefs.fontStack }
    const radii = { none: '0', sm: '0.125rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem' }

    const fontSizes = {
      xs: `${Math.round(12*ui)}px`,
      sm: `${Math.round(14*ui)}px`,
      md: `${Math.round(16*ui)}px`,
      lg: `${Math.round(18*ui)}px`,
      xl: `${Math.round(20*ui)}px`,
      '2xl': `${Math.round(24*ui)}px`,
      '3xl': `${Math.round(28*ui)}px`
    }

    const components = {
      Button: {
        baseStyle: { borderRadius: radiusKey },
        defaultProps: { colorScheme: prefs.accent || 'teal' }
      },
      Badge: { defaultProps: { colorScheme: prefs.accent || 'teal' } },
      Input: { baseStyle: { field: { borderRadius: radiusKey } } },
      Select: { baseStyle: { field: { borderRadius: radiusKey } } },
      Menu: { baseStyle: { list: { borderRadius: radiusKey } } },
      Drawer: { baseStyle: { dialog: { borderRadius: radiusKey } } },
      Card: { baseStyle: { container: { borderRadius: radiusKey } } }
    }

    return extendTheme({
      config: {
        initialColorMode: prefs.colorMode === 'dark' ? 'dark' : 'light',
        useSystemColorMode: false
      },
      styles: {
        global: (props) => ({
          'html, body': {
            background: mode('gray.50','gray.900')(props),
            color: mode('gray.800','gray.100')(props)
          },
          '#root': {
            minHeight: '100dvh',
            background: 'inherit',
            color: 'inherit'
          }
        })
      },
      fonts,
      radii,
      fontSizes,
      components
    })
  }, [prefs])

  function updatePrefs(next) {
    setPrefsState(prev => {
      const merged = { ...prev, ...next }
      if (next && Object.prototype.hasOwnProperty.call(next, 'font')) {
        merged.fontStack = stackFor(merged.font)
      }
      return merged
    })
  }

  // Alias used by UI components (e.g., ThemeDrawer) for convenience
  const setPrefs = updatePrefs

  function setPrefsFromServer(serverPrefs) {
    if (serverPrefs && typeof serverPrefs === 'object') {
      updatePrefs(serverPrefs)
    }
  }

  const value = useMemo(() => ({
    prefs,
    updatePrefs,
    setPrefs,
    theme,
    setPrefsFromServer,
    colorModeConfigScript: prefs.colorMode === 'dark' ? 'dark' : 'light',
    ACCENTS,
    FONT_OPTIONS,
    FONTS,
    RADII
  }), [prefs, theme])

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export function useThemePrefs() {
  return useContext(ThemeCtx)
}
