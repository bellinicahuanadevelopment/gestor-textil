import React, { useState } from 'react'
import {
  Container, Box, VStack, Heading, Text, FormControl, FormLabel,
  Input, InputGroup, InputRightElement, IconButton, Checkbox, Button,
  useColorModeValue, useToast, Divider
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useThemePrefs } from '../theme/ThemeContext'
import ApiDebugBadge from '../components/ApiDebugBadge'


export default function Login() {
  const { login } = useAuth()
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'
  const navigate = useNavigate()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  const cardBg = useColorModeValue('white', 'gray.800')
  const border = useColorModeValue('gray.200', 'whiteAlpha.300')
  const muted = useColorModeValue('gray.600', 'gray.400')

  async function handleSubmit(e) {
    e.preventDefault()               // <-- IMPORTANT
    if (!email || !password) {
      toast({ status: 'warning', title: 'Ingresa tu email y contraseña' })
      return
    }
    setLoading(true)
    try {
      // your AuthContext.login should call /api/v1/auth/login and store token/user
      await login(email, password, { remember })
      navigate('/', { replace: true })
    } catch (err) {
      const msg = err?.message || 'No se pudo iniciar sesión'
      toast({ status: 'error', title: 'Error de autenticación', description: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxW={{ base: 'md', md: 'xl' }} minH="100dvh" display="grid" placeItems="center" py={10}>
      <Box
        as="form"
        onSubmit={handleSubmit}
        w="full"
        maxW="lg"
        bg={cardBg}
        borderWidth="1px"
        borderColor={border}
        rounded="2xl"
        p={{ base: 6, md: 10 }}
        boxShadow="sm"
      >
        {/* Logo / Brand */}
        <VStack spacing={1} mb={6} align="center">
          <Box
            w="10"
            h="10"
            rounded="full"
            bg={`${accent}.500`}
            display="grid"
            placeItems="center"
            color="white"
            fontWeight="bold"
          >
            G
          </Box>
          <Heading size="lg">Bienvenido de vuelta</Heading>
          <Text fontSize="sm" color={muted}>Ingresa tus credenciales</Text>
        </VStack>

        <VStack spacing={4} align="stretch">
          <FormControl isRequired>
            <FormLabel>Email</FormLabel>
            <Input
              variant="filled"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              height="12"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Contraseña</FormLabel>
            <InputGroup>
              <Input
                variant="filled"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                height="12"
                pr="12"
              />
              <InputRightElement height="12" width="12">
                <IconButton
                  aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  icon={showPw ? <ViewOffIcon /> : <ViewIcon />}
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPw((v) => !v)}
                />
              </InputRightElement>
            </InputGroup>
          </FormControl>

          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Checkbox isChecked={remember} onChange={(e) => setRemember(e.target.checked)}>
              Recuérdame
            </Checkbox>
            {/* You can wire this later */}
            <Button variant="link" colorScheme={accent} size="sm">¿Olvidaste tu contraseña?</Button>
          </Box>

          <Button
            type="submit"            
            colorScheme={accent}
            height="12"
            isLoading={loading}
            loadingText="Iniciando sesión…"
          >
            Iniciar sesión
          </Button>

          {/* Optional divider & secondary actions can go here */}
          <Divider />
          <Text fontSize="sm" color={muted} textAlign="center">
            ¿No tienes cuenta? <Button variant="link" colorScheme={accent} size="sm">Registrarme</Button>
          </Text>
          <ApiDebugBadge />
        </VStack>
      </Box>
    </Container>
  )
}
