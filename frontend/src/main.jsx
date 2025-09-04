import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import App from './App'
import { ThemePrefsProvider, useThemePrefs } from './theme/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'

function ThemedApp() {
  const { theme, colorModeConfigScript } = useThemePrefs()
  return (
    <>
      {/* Mantiene el modo (claro/oscuro) entre recargas */}
      <ColorModeScript initialColorMode={colorModeConfigScript} />
      <ChakraProvider theme={theme}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ChakraProvider>
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemePrefsProvider>
      <ThemedApp />
    </ThemePrefsProvider>
  </React.StrictMode>
)
