import React from 'react'
import { Box, Text } from '@chakra-ui/react'
import AppShell from '../components/AppShell'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const { user } = useAuth()
  return (
    <AppShell>
      <Box>
        <Text fontSize="xl" fontWeight="bold">
          Bienvenido al Gestor Textil, {user?.nombre_completo || 'usuario'}.
        </Text>
        <Text mt="2" color="gray.500" _dark={{ color:'gray.300' }}>
          Esta es una página protegida. Usa el botón “Tema” en la barra superior para personalizar la interfaz.
        </Text>
      </Box>
    </AppShell>
  )
}
