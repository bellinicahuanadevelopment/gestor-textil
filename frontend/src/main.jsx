import React from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react'
import App from './App'
import { ThemePrefsProvider, useThemePrefs } from './theme/ThemeContext'
import { AuthProvider } from './contexts/AuthContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'

function ThemedApp() {
  const { theme, colorModeConfigScript } = useThemePrefs()
  return (
    <>
      <ColorModeScript initialColorMode={colorModeConfigScript} />
      <ChakraProvider theme={theme}>
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
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
