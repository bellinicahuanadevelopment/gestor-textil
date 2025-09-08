import React, { useEffect, useState, useMemo } from 'react'
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

  const [form, setForm] = useState({ nombre_completo:'', email:'', profile:'viewer' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function updateForm(k, v){ setForm(prev => ({ ...prev, [k]: v })) }

  async function load(){
    setLoading(true)
    try {
      const list = await authedFetchJson('/admin/users')
      const data = Array.isArray(list) ? list.find(u => u.id === id) : null
      if (data) {
        setForm({
          nombre_completo: data.nombre_completo || '',
          email: data.email || '',
          profile: data.profile || 'viewer'
        })
      } else {
        toast({ status:'warning', title:'Usuario no encontrado' })
        navigate('/configuracion', { replace: true })
      }
    } catch(err){
      toast({
        status:'error',
        title:'No se pudo cargar el usuario',
        description: String(err?.message || err)
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ load() },[id])

  async function save(){
    setSaving(true)
    try{
      await authedFetchJson(`/admin/users/${id}`, { method:'PUT', body: JSON.stringify(form) })
      toast({ status:'success', title:'Cambios guardados' })
    }catch(err){
      toast({ status:'error', title:'No se pudo guardar', description: String(err?.message || err) })
    }finally{
      setSaving(false)
    }
  }

  // delete dialog
  const delDisc = useDisclosure()
  async function confirmDelete(){
    setDeleting(true)
    try {
      await authedFetchJson(`/admin/users/${id}`, { method:'DELETE' })
      toast({ status:'success', title:'Usuario eliminado' })
      navigate('/configuracion', { replace: true })
    } catch(err){
      toast({ status:'error', title:'No se pudo eliminar', description: String(err?.message || err) })
    } finally {
      setDeleting(false)
      delDisc.onClose()
    }
  }

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
                onClick={save}
                isLoading={saving}
              />
            </Tooltip>
          ) : (
            <Button leftIcon={<FiSave />} colorScheme={accent} onClick={save} isLoading={saving}>
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
                isDisabled={!isAdmin}
                isLoading={deleting}
              />
            ) : (
              <Button
                leftIcon={<DeleteIcon />}
                colorScheme="red"
                variant="outline"
                onClick={delDisc.onOpen}
                isDisabled={!isAdmin}
                isLoading={deleting}
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
            />
          </FormControl>
          <FormControl>
            <FormLabel>Perfil</FormLabel>
            <Select
              value={form.profile}
              onChange={e=>updateForm('profile', e.target.value)}
            >
              <option value="viewer">Observador</option>
              <option value="seller">Vendedor</option>
              <option value="manager">Gerente</option>
              <option value="admin">Admin</option>
            </Select>
          </FormControl>
        </VStack>
      </Box>

      {/* Delete confirm */}
      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={undefined}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Eliminar usuario</AlertDialogHeader>
          <AlertDialogBody>
            ¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button onClick={delDisc.onClose}>Cancelar</Button>
            <Button colorScheme="red" ml={3} onClick={confirmDelete} isLoading={deleting} isDisabled={!isAdmin}>
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  )
}
