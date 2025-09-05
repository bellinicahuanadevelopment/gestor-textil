import React from 'react'
import { Box, Heading, Text } from '@chakra-ui/react'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const { user } = useAuth()

  return (
    <Box>
      <Heading size="lg" mb="2">
        Bienvenido al Gestor Textil, {user?.nombre_completo || 'Usuario'}.
      </Heading>
      <Text color="gray.500">
        Esta es una página protegida. Usa el botón “Tema” en la barra superior para personalizar la interfaz.
      </Text>
    </Box>
  )
}
