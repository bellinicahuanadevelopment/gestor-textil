import React, { useState } from 'react'
import {
  Box, Button, FormControl, FormLabel, Input, VStack, Heading, useToast
} from '@chakra-ui/react'
import { useAuth } from '../contexts/AuthContext'
import ApiDebugBadge from '../components/ApiDebugBadge'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast({ title:'Bienvenido', status:'success', duration:1500 })
      navigate('/', { replace:true })
    } catch (err) {
      toast({ title: err.message || 'Error al iniciar sesión', status:'error', duration:2000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box minH="100dvh" display="grid" placeItems="center" p="6">
      <Box as="form" onSubmit={onSubmit} w="full" maxW="md" p="6" borderWidth="1px" borderRadius="lg">
        <Heading size="md" mb="4">Ingresar</Heading>
        <VStack spacing="4">
          <FormControl isRequired>
            <FormLabel>Email</FormLabel>
            <Input type="email" value={email} onChange={(e)=> setEmail(e.target.value)} placeholder="tu@correo.com" />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Contraseña</FormLabel>
            <Input type="password" value={password} onChange={(e)=> setPassword(e.target.value)} placeholder="••••••••" />
          </FormControl>
          <Button type="submit" isLoading={loading} w="full">Ingresar</Button>
        </VStack>
        {process.env.NODE_ENV !== 'production' || import.meta.env.VITE_DEBUG === '1' ? <ApiDebugBadge /> : null}
      </Box>
    </Box>
  )
}
