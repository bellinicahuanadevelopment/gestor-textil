import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box, Heading, Text, Stack, HStack, VStack, Tabs, TabList, TabPanels, TabPanel, Tab,
  Badge, useColorModeValue, Button, IconButton, Input, InputGroup, InputLeftElement,
  Select, Tooltip, useToast, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel,
  AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader,
  AlertDialogBody, AlertDialogFooter, useDisclosure, Spacer,
  Card, CardHeader, CardBody, useBreakpointValue, Skeleton, SkeletonText,
  usePrefersReducedMotion
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, SearchIcon } from '@chakra-ui/icons'
import { useThemePrefs } from '../theme/ThemeContext'
import { useAuthedFetchJson } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

function AccentTab({ label, underline, disabled=false }) {
  return (
    <Tab
      isDisabled={disabled}
      px="2.5"
      py="2"
      mr="3"
      fontWeight="semibold"
      color="gray.600"
      _dark={{ color: 'gray.300' }}
      borderBottom="2px solid"
      borderColor="transparent"
      _selected={{ color: underline, borderColor: underline }}
    >
      <Text lineHeight="1.25">{label}</Text>
    </Tab>
  )
}

function fmtDateTimeISO(s){
  if(!s) return '—'
  try{
    return new Date(s).toLocaleString('es-CO', {
      year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit'
    })
  }catch{ return String(s) }
}

export default function Configuracion(){
  const { prefs } = useThemePrefs()
  const { user } = useAuth()
  const authedFetchJson = useAuthedFetchJson()
  const accent = prefs?.accent || 'teal'
  const toast = useToast()

  const canManage = user?.profile === 'admin' || user?.profile === 'manager'
  const isAdmin = user?.profile === 'admin'

  // look & feel
  const underline = useColorModeValue(`${accent}.500`, `${accent}.300`)
  const muted = useColorModeValue('gray.600','gray.400')
  const barBg = useColorModeValue('white','gray.800')
  const barBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')
  const inputBg = useColorModeValue('blackAlpha.50','whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')
  const titleColor = useColorModeValue(`${accent}.700`, `${accent}.200`)
  const prefersReducedMotion = usePrefersReducedMotion()
  const smooth = prefersReducedMotion ? 'none' : 'border-color 200ms ease, box-shadow 200ms ease'

  // tabs
  const [tabIndex, setTabIndex] = useState(0)

  // users state
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [query, setQuery] = useState('')

  const headingRef = useRef(null)
  useEffect(() => { if (headingRef.current) headingRef.current.focus() }, [])

  async function loadUsers(){
    if (!canManage) return
    setLoadingUsers(true)
    try {
      const data = await authedFetchJson('/admin/users')
      setUsers(Array.isArray(data) ? data : [])
    } catch(err){
      toast({
        status:'error',
        title:'No se pudieron cargar los usuarios',
        description: String(err?.message || err)
      })
    } finally {
      setLoadingUsers(false)
    }
  }

  // load when entering the Usuarios tab
  useEffect(() => { if (tabIndex === 1) loadUsers() }, [tabIndex, canManage]) // 0: General, 1: Usuarios

  const filtered = useMemo(() => {
    const q = (query||'').toLowerCase()
    if (!q) return users
    return users.filter(u =>
      (u.nombre_completo||'').toLowerCase().includes(q) ||
      (u.email||'').toLowerCase().includes(q) ||
      (u.profile||'').toLowerCase().includes(q)
    )
  }, [users, query])

  // add user modal
  const [adding, setAdding] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ nombre_completo:'', email:'', password:'', profile:'viewer' })
  function updateForm(k, v){ setForm(prev => ({ ...prev, [k]: v })) }

  async function createUser(){
    try {
      setCreating(true)
      const data = await authedFetchJson('/admin/users', { method:'POST', body: JSON.stringify(form) })
      toast({ status:'success', title:'Usuario creado' })
      setForm({ nombre_completo:'', email:'', password:'', profile:'viewer' })
      setAdding(false)
      await loadUsers()
    } catch(err){
      toast({ status:'error', title:'No se pudo crear el usuario', description: String(err?.message || err) })
    } finally {
      setCreating(false)
    }
  }

  // delete user dialog (admins only)
  const [toDelete, setToDelete] = useState(null)
  const delDisc = useDisclosure()
  async function confirmDelete(){
    if (!toDelete) return
    try {
      await authedFetchJson(`/admin/users/${toDelete.id}`, { method:'DELETE' })
      toast({ status:'success', title:'Usuario eliminado' })
      delDisc.onClose()
      setToDelete(null)
      await loadUsers()
    } catch(err){
      toast({ status:'error', title:'No se pudo eliminar', description: String(err?.message || err) })
    }
  }

  const compact = useBreakpointValue({ base: true, md: false })

  const skeletons = Array.from({ length: 4 })

  // Single, unmistakable primary actions:
  // - General: (none yet)
  // - Usuarios: "Agregar usuario" at end of bar (eye path)
  return (
    <Box as="main">
      <Heading
        ref={headingRef}
        tabIndex={-1}
        size="xl"
        mb="1"
        lineHeight="1.2"
        letterSpacing="-0.02em"
      >
        Configuración
      </Heading>
      <Text fontSize="sm" color={muted} mb="3" lineHeight="1.45" maxW="72ch">
        Ajustes de la aplicación
      </Text>

      {/* Tabs header like the rest of the app */}
      <Tabs
        index={tabIndex}
        onChange={setTabIndex}
        variant="unstyled"
        isLazy
      >
        <TabList
          borderBottom="1px solid"
          borderColor={barBorder}
          pb="2"
          mb="3"
          role="navigation"
          aria-label="Secciones de configuración"
        >
          <AccentTab label="General" underline={underline} />
          {canManage && (
            <AccentTab label="Usuarios" underline={underline} />
          )}
        </TabList>

        <TabPanels>
          {/* General */}
          <TabPanel px="0">
            <Box borderRadius="md" border="1px solid" borderColor={barBorder} p="4">
              <Text color={muted} lineHeight="1.45">No hay opciones todavía.</Text>
            </Box>
          </TabPanel>

          {/* Usuarios (only if visible) */}
          {canManage && (
            <TabPanel px="0">
              <Box borderRadius="md" border="1px solid" borderColor={barBorder} p="4">
                <HStack mb="4" align="center" spacing="3" wrap="wrap">
                  <InputGroup maxW="500px" flex="1">
                    <InputLeftElement pointerEvents="none">
                      <SearchIcon color="gray.400" aria-hidden="true" />
                    </InputLeftElement>
                    <Input
                      placeholder="Buscar por nombre, email o perfil"
                      value={query}
                      onChange={(e)=>setQuery(e.target.value)}
                      variant="filled"
                      bg={inputBg}
                      _hover={{ bg: inputBg }}
                      _focus={{ bg: inputBg, borderColor: inputBorder }}
                      aria-label="Buscar usuarios"
                    />
                  </InputGroup>

                  <Spacer />

                  {/* Primary action: Add user */}
                  {compact ? (
                    <Tooltip label="Agregar usuario">
                      <IconButton
                        aria-label="Agregar usuario"
                        icon={<AddIcon />}
                        colorScheme={accent}
                        onClick={()=>setAdding(true)}
                        size="md" // ≥44px touch target
                      />
                    </Tooltip>
                  ) : (
                    <Button colorScheme={accent} leftIcon={<AddIcon aria-hidden="true" />} onClick={()=>setAdding(true)}>
                      Agregar usuario
                    </Button>
                  )}
                </HStack>

                {/* Users list with loading skeletons */}
                {loadingUsers ? (
                  <Stack spacing="3" aria-live="polite">
                    {skeletons.map((_,i)=>(
                      <Card key={`sk-${i}`} variant="outline" sx={{ transition: smooth }}>
                        <CardHeader pb="2">
                          <HStack align="start" justify="space-between">
                            <Box w="full">
                              <Skeleton height="20px" maxW="260px" />
                              <SkeletonText mt="2" noOfLines={1} maxW="220px" />
                            </Box>
                            <Skeleton height="20px" width="72px" />
                          </HStack>
                        </CardHeader>
                        <CardBody pt="2">
                          <SkeletonText noOfLines={2} />
                        </CardBody>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <Stack spacing="3">
                    {filtered.map(u => {
                      const asProp = isAdmin ? Link : undefined
                      const toProp = isAdmin ? `/configuracion/usuarios/${u.id}` : undefined
                      return (
                        <Card
                          key={u.id}
                          as={asProp}
                          to={toProp}
                          variant="outline"
                          cursor={isAdmin ? 'pointer' : 'default'}
                          _hover={isAdmin ? { borderColor: `${accent}.300` } : undefined}
                          _focusWithin={isAdmin ? { borderColor: `${accent}.400`, boxShadow: 'outline' } : undefined}
                          sx={{ transition: smooth }}
                        >
                          <CardHeader pb="2">
                            <HStack align="start" justify="space-between">
                              <Box>
                                <Heading size="md" lineHeight="1.2" letterSpacing="-0.01em">{u.nombre_completo}</Heading>
                                <Text fontSize="sm" color="gray.500" lineHeight="1.45">{u.email}</Text>
                              </Box>
                              <Badge
                                colorScheme={
                                  u.profile === 'admin' ? 'purple' :
                                  u.profile === 'manager' ? 'blue' : 'gray'
                                }
                                textTransform="none"
                                aria-label={`Perfil: ${u.profile}`}
                              >
                                {u.profile}
                              </Badge>
                            </HStack>
                          </CardHeader>
                          <CardBody pt="2">
                            <HStack justify="space-between" align="center" wrap="wrap" gap="3">
                              <Text fontSize="sm" color="gray.600" lineHeight="1.45">
                                Creado:&nbsp;
                                <Box as="span" fontFamily="mono" sx={{ fontVariantNumeric:'tabular-nums' }}>
                                  {fmtDateTimeISO(u.created_at)}
                                </Box>
                              </Text>

                              {isAdmin && (
                                <Tooltip label="Eliminar usuario">
                                  <IconButton
                                    aria-label={`Eliminar usuario ${u.nombre_completo}`}
                                    icon={<DeleteIcon />}
                                    size="sm"
                                    variant="outline"
                                    colorScheme="red"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setToDelete(u); delDisc.onOpen() }}
                                  />
                                </Tooltip>
                              )}
                            </HStack>
                          </CardBody>
                        </Card>
                      )
                    })}

                    {filtered.length === 0 && (
                      <Box borderWidth="1px" rounded="md" p="10" textAlign="center" color={muted}>
                        {users.length === 0 ? 'No hay usuarios.' : 'Sin resultados para tu búsqueda.'}
                      </Box>
                    )}
                  </Stack>
                )}
              </Box>
            </TabPanel>
          )}
        </TabPanels>
      </Tabs>

      {/* Add user modal */}
      <Modal isOpen={adding} onClose={()=>setAdding(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Agregar usuario</ModalHeader>
          <ModalBody>
            <VStack spacing="3" align="stretch">
              <FormControl isRequired>
                <FormLabel>Nombre completo</FormLabel>
                <Input
                  variant="filled"
                  value={form.nombre_completo}
                  onChange={e=>updateForm('nombre_completo', e.target.value)}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input
                  variant="filled"
                  type="email"
                  inputMode="email"
                  value={form.email}
                  onChange={e=>updateForm('email', e.target.value)}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Contraseña</FormLabel>
                <Input
                  variant="filled"
                  type="password"
                  value={form.password}
                  onChange={e=>updateForm('password', e.target.value)}
                  aria-describedby="pwd-help"
                />
                <Text id="pwd-help" fontSize="xs" color="gray.500" mt="1">
                  Mínimo 8 caracteres. Evita usar datos sensibles.
                </Text>
              </FormControl>
              <FormControl>
                <FormLabel>Perfil</FormLabel>
                <Select value={form.profile} onChange={e=>updateForm('profile', e.target.value)}>
                  <option value="viewer">Observador</option>
                  <option value="seller">Vendedor</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={()=>setAdding(false)} variant="outline">
              Cancelar
            </Button>
            <Button colorScheme={accent} onClick={createUser} isLoading={creating}>
              Crear
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete user confirm (admins only) */}
      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={undefined}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Eliminar usuario</AlertDialogHeader>
          <AlertDialogBody>
            ¿Seguro que deseas eliminar a <b>{toDelete?.nombre_completo}</b>? Esta acción no se puede deshacer.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button onClick={delDisc.onClose} variant="outline">Cancelar</Button>
            <Button colorScheme="red" ml={3} onClick={confirmDelete} isDisabled={!isAdmin}>
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  )
}
