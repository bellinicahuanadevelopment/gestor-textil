import React, { useEffect, useMemo, useState } from 'react'
import {
  Box, Heading, Text, Stack, HStack, VStack, Tabs, TabList, TabPanels, TabPanel, Tab,
  Badge, useColorModeValue, Button, IconButton, Input, InputGroup, InputLeftElement,
  Select, Table, Thead, Tbody, Tr, Th, Td, Tooltip, useToast, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel,
  AlertDialog, AlertDialogOverlay, AlertDialogContent, AlertDialogHeader,
  AlertDialogBody, AlertDialogFooter, useDisclosure, Spacer
} from '@chakra-ui/react'
import { AddIcon, DeleteIcon, SearchIcon } from '@chakra-ui/icons'
import { useThemePrefs } from '../theme/ThemeContext'
import { useAuthedFetchJson } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

function AccentTab({ label, count=0, underline, pillBg, pillColor, disabled=false }) {
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
      <HStack spacing="2">
        <Text>{label}</Text>
        <Badge
          rounded="full"
          px="2"
          bg={pillBg}
          color={pillColor}
          borderWidth="1px"
          borderColor={useColorModeValue('blackAlpha.200','whiteAlpha.300')}
        >
          {count}
        </Badge>
      </HStack>
    </Tab>
  )
}

export default function Configuracion(){
  const { prefs } = useThemePrefs()
  const { user } = useAuth()
  const authedFetchJson = useAuthedFetchJson()
  const accent = prefs?.accent || 'teal'
  const toast = useToast()

  const canManage = user?.profile === 'admin' || user?.profile === 'manager'

  // look & feel
  const underline = useColorModeValue(`${accent}.500`, `${accent}.300`)
  const pillBg = useColorModeValue(`${accent}.50`, `${accent}.900`)
  const pillColor = useColorModeValue(`${accent}.700`, `${accent}.200`)
  const muted = useColorModeValue('gray.600','gray.400')
  const barBg = useColorModeValue('white','gray.800')
  const barBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')
  const inputBg = useColorModeValue('blackAlpha.50','whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')

  // tabs
  const [tabIndex, setTabIndex] = useState(0)

  // users state
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [query, setQuery] = useState('')

  async function loadUsers(){
    if (!canManage) return
    setLoadingUsers(true)
    try {
      const data = await authedFetchJson('/admin/users')
      setUsers(Array.isArray(data) ? data : [])
    } catch(err){
      toast({ status:'error', title:'No se pudieron cargar los usuarios', description: String(err?.message || err) })
    } finally {
      setLoadingUsers(false)
    }
  }


  // load when entering the Usuarios tab
  useEffect(() => { if (tabIndex === 1) loadUsers() }, [tabIndex]) // 0: General, 1: Usuarios

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
  const [form, setForm] = useState({ nombre_completo:'', email:'', password:'', profile:'viewer' })
  function updateForm(k, v){ setForm(prev => ({ ...prev, [k]: v })) }

  async function createUser(){
    try {
      const data = await authedFetchJson('/admin/users', { method:'POST', body: JSON.stringify(form) })
      toast({ status:'success', title:'Usuario creado' })
      setForm({ nombre_completo:'', email:'', profile:'user', password:'' })
      await loadUsers()
    } catch(err){
      toast({ status:'error', title:'No se pudo crear el usuario', description: String(err?.message || err) })
    }
  }


  // delete user dialog
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


  return (
    <Box>
      <Heading size="lg" mb="1">Configuración</Heading>
      <Text fontSize="sm" color={muted} mb="3">Ajustes de la aplicación</Text>

      {/* Tabs header like the rest of the app */}
      <Tabs
        index={tabIndex}
        onChange={setTabIndex}
        variant="unstyled"
      >
        <TabList
          bg={barBg}
          borderBottom="1px solid"
          borderColor={barBorder}
          pb="2"
          mb="3"
        >
          <AccentTab label="General" count={0} underline={underline} pillBg={pillBg} pillColor={pillColor} />
          {canManage && (
            <AccentTab label="Usuarios" count={users.length} underline={underline} pillBg={pillBg} pillColor={pillColor} />
          )}
        </TabList>

        <TabPanels>
          {/* General */}
          <TabPanel px="0">
            <Box borderRadius="md" border="1px solid" borderColor={barBorder} p="4">
              <Text color={muted}>No hay opciones todavía.</Text>
            </Box>
          </TabPanel>

          {/* Usuarios (only if visible) */}
          {canManage && (
            <TabPanel px="0">
              <Box borderRadius="md" border="1px solid" borderColor={barBorder} p="4">
                <HStack mb="4" align="center">
                  <InputGroup maxW="420px">
                    <InputLeftElement pointerEvents="none">
                      <SearchIcon color="gray.400" />
                    </InputLeftElement>
                    <Input
                      placeholder="Buscar por nombre, email o perfil"
                      value={query}
                      onChange={(e)=>setQuery(e.target.value)}
                      variant="filled"
                      bg={inputBg}
                      borderColor={inputBorder}
                      _hover={{ bg: inputBg }}
                      _focus={{ bg: inputBg, borderColor: inputBorder }}
                    />
                  </InputGroup>
                  <Spacer />
                  <Button colorScheme={accent} leftIcon={<AddIcon />} onClick={()=>setAdding(true)}>
                    Agregar usuario
                  </Button>
                </HStack>

                <Box overflowX="auto">
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr>
                        <Th>Nombre</Th>
                        <Th>Email</Th>
                        <Th>Perfil</Th>
                        <Th>Creado</Th>
                        <Th isNumeric>Acciones</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {filtered.map(u => (
                        <Tr key={u.id}>
                          <Td>{u.nombre_completo}</Td>
                          <Td>{u.email}</Td>
                          <Td>
                            <Badge colorScheme={
                              u.profile === 'admin' ? 'purple' :
                              u.profile === 'manager' ? 'blue' : 'gray'
                            } textTransform="none">
                              {u.profile}
                            </Badge>
                          </Td>
                          <Td>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</Td>
                          <Td isNumeric>
                            <Tooltip label="Eliminar usuario">
                              <IconButton
                                aria-label="Eliminar usuario"
                                icon={<DeleteIcon />}
                                size="sm"
                                variant="outline"
                                colorScheme="red"
                                onClick={() => { setToDelete(u); delDisc.onOpen() }}
                              />
                            </Tooltip>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </Box>

                {!loadingUsers && filtered.length === 0 && (
                  <Box borderWidth="1px" rounded="md" p="10" textAlign="center" color={muted} mt="4">
                    {users.length === 0 ? 'No hay usuarios.' : 'Sin resultados para tu búsqueda.'}
                  </Box>
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
                <Input variant="filled" value={form.nombre_completo} onChange={e=>updateForm('nombre_completo', e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input variant="filled" type="email" value={form.email} onChange={e=>updateForm('email', e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Contraseña</FormLabel>
                <Input variant="filled" type="password" value={form.password} onChange={e=>updateForm('password', e.target.value)} />
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
            <Button mr={3} onClick={()=>setAdding(false)}>Cancelar</Button>
            <Button colorScheme={accent} onClick={createUser}>Crear</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete user confirm */}
      <AlertDialog isOpen={delDisc.isOpen} onClose={delDisc.onClose} leastDestructiveRef={undefined}>
        <AlertDialogOverlay />
        <AlertDialogContent>
          <AlertDialogHeader>Eliminar usuario</AlertDialogHeader>
          <AlertDialogBody>
            ¿Seguro que deseas eliminar a <b>{toDelete?.nombre_completo}</b>? Esta acción no se puede deshacer.
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button onClick={delDisc.onClose}>Cancelar</Button>
            <Button colorScheme="red" ml={3} onClick={confirmDelete}>Eliminar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Box>
  )
}
