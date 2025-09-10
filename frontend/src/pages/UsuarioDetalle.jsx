import React, { useEffect, useState } from 'react'
import {
  Box, Heading, Text, Stack, HStack, VStack, useColorModeValue, Button, IconButton,
  Input, Select, FormControl, FormLabel, useToast, AlertDialog, AlertDialogOverlay,
  AlertDialogContent, AlertDialogHeader, AlertDialogBody, AlertDialogFooter, useDisclosure,
  Tooltip, useBreakpointValue
} from '@chakra-ui/react'
import { ArrowBackIcon, DeleteIcon } from '@chakra-ui/icons'
import { FiSave } from 'react-icons/fi'
import { useParams, useNavigate } from 'react-router-dom'
import { useThemePrefs } from '../theme/ThemeContext'
import { useAuthedFetchJson } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export default function UsuarioDetalle(){
  const { id } = useParams()
  const navigate = useNavigate()
  const { prefs } = useThemePrefs()
  const { user } = useAuth()
  const authedFetchJson = useAuthedFetchJson()
  const toast = useToast()
  const accent = prefs?.accent || 'teal'
  const isAdmin = user?.profile === 'admin'

  const barBg = useColorModeValue('white','gray.800')
  const barBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')
  const inputBg = useColorModeValue('blackAlpha.50','whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')
  const muted = useColorModeValue('gray.600','gray.400')

  const compact = useBreakpointValue({ base: true, md: false })

  const queryClient = useQueryClient()

  // Load user (prefer single-resource endpoint)
  const {
    data: userData,
    isLoading,
    isFetching,
    isError
  } = useQuery({
    queryKey: ['admin','user', id],
    queryFn: () => authedFetchJson(`/admin/users/${id}`),
    enabled: !!id,
    retry: 1,
    onError: () => {
      toast({ status:'warning', title:'Usuario no encontrado' })
      navigate('/configuracion', { replace: true })
    }
  })

  // Local editable form state, hydrated once data arrives
  const [form, setForm] = useState({ nombre_completo:'', email:'', profile:'viewer' })
  useEffect(() => {
    if (userData) {
      setForm({
        nombre_completo: userData.nombre_completo || '',
        email: userData.email || '',
        profile: userData.profile || 'viewer'
      })
    }
  }, [userData])

  function updateForm(k, v){ setForm(prev => ({ ...prev, [k]: v })) }

  const saveUser = useMutation({
    mutationFn: (body) => authedFetchJson(`/admin/users/${id}`, {
      method:'PUT',
      body: JSON.stringify(body)
    }),
    onSuccess: (updated) => {
      // Optimistically update this user and invalidate the list
      queryClient.setQueryData(['admin','user', id], (old) => ({ ...(old || {}), ...(updated || body) }))
      queryClient.invalidateQueries({ queryKey: ['admin','users'] })
      toast({ status:'success', title:'Cambios guardados' })
    },
    onError: (err) => {
      toast({ status:'error', title:'No se pudo guardar', description: String(err?.message || err) })
    }
  })

  const delDisc = useDisclosure()
  const deleteUser = useMutation({
    mutationFn: () => authedFetchJson(`/admin/users/${id}`, { method:'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['admin','user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin','users'] })
      toast({ status:'success', title:'Usuario eliminado' })
      navigate('/configuracion', { replace: true })
    },
    onError: (err) => {
      toast({ status:'error', title:'No se pudo eliminar', description: String(err?.message || err) })
    }
  })

  return (
    <Box>
      <Heading size="lg" mb="1">Usuario</Heading>
      <Text fontSize="sm" color={muted} mb="3">Editar información del usuario</Text>

      <HStack
        align="center"
        justify="space-between"
        bg={barBg}
        borderBottom="1px solid"
        borderColor={barBorder}
        pb="3"
        mb="3"
      >
        <HStack>
          <IconButton aria-label="Volver" icon={<ArrowBackIcon />} variant="ghost" size="sm" onClick={()=>navigate(-1)} />
        </HStack>
        <HStack>
          {compact ? (
            <Tooltip label="Guardar">
              <IconButton
                aria-label="Guardar"
                icon={<FiSave />}
                colorScheme={accent}
                onClick={() => saveUser.mutate(form)}
                isLoading={saveUser.isPending}
                isDisabled={isLoading || isFetching}
              />
            </Tooltip>
          ) : (
            <Button
              leftIcon={<FiSave />}
              colorScheme={accent}
              onClick={() => saveUser.mutate(form)}
              isLoading={saveUser.isPending}
              isDisabled={isLoading || isFetching}
            >
              Guardar
            </Button>
          )}

          <Tooltip label={isAdmin ? 'Eliminar usuario' : 'Solo administradores'}>
            {compact ? (
              <IconButton
                aria-label="Eliminar"
                icon={<DeleteIcon />}
                colorScheme="red"
                variant="outline"
                onClick={delDisc.onOpen}
                isDisabled={!isAdmin || isLoading || isFetching}
                isLoading={deleteUser.isPending}
              />
            ) : (
              <Button
                leftIcon={<DeleteIcon />}
                colorScheme="red"
                variant="outline"
                onClick={delDisc.onOpen}
                isDisabled={!isAdmin || isLoading || isFetching}
                isLoading={deleteUser.isPending}
              >
                Eliminar
              </Button>
            )}
          </Tooltip>
        </HStack>
      </HStack>

      <Box borderRadius="md" border="1px solid" borderColor={barBorder} p="4">
        <VStack align="stretch" spacing="3">
          <FormControl isRequired>
            <FormLabel>Nombre completo</FormLabel>
            <Input
              variant="filled"
              value={form.nombre_completo}
              onChange={e=>updateForm('nombre_completo', e.target.value)}
              bg={inputBg}
              _hover={{ bg: inputBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
              isDisabled={isLoading || isFetching || saveUser.isPending}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Email</FormLabel>
            <Input
              type="email"
              variant="filled"
              value={form.email}
              onChange={e=>updateForm('email', e.target.value)}
              bg={inputBg}
              _hover={{ bg: inputBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
              isDisabled={isLoading || isFetching || saveUser.isPending}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Perfil</FormLabel>
            <Select
              value={form.profile}
              onChange={e=>updateForm('profile', e.target.value)}
              isDisabled={isLoading || isFetching || saveUser.isPending}
            >
              <option value="viewer">Observador</option>
              <option value="seller">Vendedor</option>
              <option value="manager">Gerente</option>
              <option value="admin">Admin</option>
            </Select>
          </FormControl>
        </VStack>
      </Box>

      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={undefined}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Eliminar usuario</AlertDialogHeader>
          <AlertDialogBody>
            ¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button onClick={delDisc.onClose}>Cancelar</Button>
            <Button
              colorScheme="red"
              ml={3}
              onClick={() => deleteUser.mutate()}
              isLoading={deleteUser.isPending}
              isDisabled={!isAdmin}
            >
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  )
}
