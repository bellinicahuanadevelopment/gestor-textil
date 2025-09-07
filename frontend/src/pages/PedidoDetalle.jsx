import React, { useEffect, useMemo, useState, useRef } from 'react'
import {
  Box, Heading, Text, Stack, HStack, VStack, Card, CardBody, CardHeader, Button,
  IconButton, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper,
  NumberDecrementStepper, Spacer, Badge, Tabs, TabList, Tab, useColorModeValue,
  useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Input, InputGroup, InputLeftElement, Tooltip, useBreakpointValue,
  AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader,
  AlertDialogContent, AlertDialogOverlay, useDisclosure
} from '@chakra-ui/react'
import {
  ArrowBackIcon, DeleteIcon, AddIcon, SearchIcon, CheckIcon,
  ChevronLeftIcon, ChevronRightIcon
} from '@chakra-ui/icons'
import { FiSave } from 'react-icons/fi'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthedFetch } from '../lib/api'
import { useThemePrefs } from '../theme/ThemeContext'
import { useAuth } from '../contexts/AuthContext'

function money(n){try{return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0))}catch{return `${n}`}}
const fmtTime = (d)=> new Intl.DateTimeFormat('es-CO',{hour:'2-digit',minute:'2-digit'}).format(d)

export default function PedidoDetalle(){
  const { id } = useParams()
  const navigate = useNavigate()
  const { authedFetch } = useAuthedFetch()
  const { prefs } = useThemePrefs()
  const { user } = useAuth()
  const accent = prefs?.accent || 'teal'
  const toast = useToast()

  const [head, setHead] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [dirtyIds, setDirtyIds] = useState(() => new Set())
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // delete dialog
  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure()
  const cancelRef = useRef()

  async function load(){
    setLoading(true)
    const res = await authedFetch(`/pedidos/${id}`)
    const data = await res.json()
    setHead(data.pedido || null)
    setItems(Array.isArray(data.items) ? data.items : [])
    setDirtyIds(new Set())
    setLoading(false)
  }
  useEffect(()=>{ load() },[id])

  const isApprover = ['manager', 'admin'].includes(user?.profile)
  const isApproved = (status) => {
    const s = String(status || '').toLowerCase()
    return s === 'approved' || s === 'aprobado'
  }
  const isDraft = (status) => String(status||'').toLowerCase() === 'draft'
  const canEdit = head && !isApproved(head.status)

  // removeItem
  async function removeItem(itemId){
    const r = await authedFetch(`/pedidos/${id}/items/${itemId}`, { method:'DELETE' })
    if(!r.ok){ toast({status:'error', title:'No se pudo eliminar el ítem'}) ; return }
    toast({status:'success', title:'Ítem eliminado'})
    load()
  }

  // confirm delete (from dialog)
  async function confirmDelete(){
    setDeleting(true)
    const r = await authedFetch(`/pedidos/${id}`, { method:'DELETE' })
    setDeleting(false)
    if(!r.ok){
      toast({status:'error', title:'No se pudo eliminar el pedido'})
      return
    }
    toast({status:'success', title:'Pedido eliminado'})
    closeDelete()
    navigate('/pedidos')
  }

  // Save all edited items
  async function saveAll(){
    if (dirtyIds.size === 0) return
    setSaving(true)
    const toSave = items.filter(i => dirtyIds.has(i.id)).map(i => ({
      id: i.id,
      body: { cantidad: Number(i.cantidad), precio: Number(i.precio) }
    }))

    const failures = []
    for (const s of toSave) {
      const r = await authedFetch(`/pedidos/${id}/items/${s.id}`, {
        method: 'PUT',
        body: JSON.stringify(s.body)
      })
      if (!r.ok) failures.push(s.id)
    }
    setSaving(false)

    if (failures.length) {
      toast({ status:'error', title:`No se guardaron ${failures.length} ítem(s)` })
    } else {
      toast({ status:'success', title:`Cambios guardados (${toSave.length})` })
      await load()
    }
  }

  // ---- Approval (optimistic)
  async function handleApprove(){
    if (!isApprover || !head || isApproved(head.status)) return
    const prev = head.status
    const optimisticAt = new Date()
    setHead(h => h ? { ...h, status: 'approved', approved_at: optimisticAt.toISOString() } : h)
    setApproving(true)
    try {
      const r = await authedFetch(`/pedidos/${id}/approve`, { method:'POST' })
      const data = await r.json().catch(()=> ({}))
      if (!r.ok) throw new Error(data?.message || `HTTP ${r.status}`)
      const newStatus = data?.pedido?.status || 'approved'
      const approvedAt = data?.pedido?.approved_at ? new Date(data.pedido.approved_at) : optimisticAt
      setHead(h => h ? { ...h, status: newStatus, approved_at: approvedAt.toISOString() } : h)
      toast({
        status:'success',
        title:'Pedido aprobado',
        description:`Aprobado a las ${fmtTime(approvedAt)}`
      })
    } catch (err) {
      setHead(h => h ? { ...h, status: prev, approved_at: undefined } : h)
      toast({ status:'error', title:'No se pudo aprobar', description: String(err?.message || err) })
    } finally {
      setApproving(false)
    }
  }

  // ---- Submit (draft → submitted) for regular users
  async function handleSubmit(){
    if (!head || !isDraft(head.status)) return
    setSubmitting(true)
    try {
      const r = await authedFetch(`/pedidos/${id}/submit`, { method:'POST' })
      const data = await r.json().catch(()=> ({}))
      if (!r.ok) throw new Error(data?.message || `HTTP ${r.status}`)
      setHead(h => h ? { ...h, status: 'submitted' } : h)
      toast({ status:'success', title:'Pedido enviado' })
    } catch (err) {
      toast({ status:'error', title:'No se pudo enviar', description: String(err?.message || err) })
    } finally {
      setSubmitting(false)
    }
  }

  // ——— Look & feel
  const underline = useColorModeValue(`${accent}.500`, `${accent}.300`)
  const pillBg = useColorModeValue(`${accent}.50`, `${accent}.900`)
  const pillColor = useColorModeValue(`${accent}.700`, `${accent}.200`)
  const barBg = useColorModeValue('white','gray.800')
  const barBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')
  const muted = useColorModeValue('gray.600','gray.400')
  const panelBg = useColorModeValue('transparent', 'transparent')

  const dirtyCount = dirtyIds.size
  const compact = useBreakpointValue({ base: true, md: false })

  const showApprove = isApprover && head && !isApproved(head.status)
  const showSubmit = !isApprover && head && isDraft(head.status)
  const titleColor = useColorModeValue(`${accent}.700`, `${accent}.200`)

  return (
    <Box>
      <Heading size="lg" mb="1">Pedido</Heading>
      {head && (
        <Text fontSize="sm" color={muted} mb="3">
          {head.cliente_nombre} • {head.direccion_entrega} • Entrega: {head.fecha_entrega}
          <Badge ml="3" colorScheme="blue" textTransform="none">{head.status}</Badge>
        </Text>
      )}

      {/* Top bar — responsive layout */}
      <Stack
        direction={{ base: 'column', md: 'row' }}
        align={{ base: 'stretch', md: 'center' }}
        justify="space-between"
        bg={barBg}
        borderBottom="1px solid"
        borderColor={barBorder}
        pb="3"
        mb="3"
        spacing={{ base: 3, md: 2 }}
      >
        {/* LEFT: back arrow + tabs */}
        <HStack spacing="2" align="center">
          <Tooltip label="Volver a pedidos">
            <IconButton
              aria-label="Volver a pedidos"
              icon={<ArrowBackIcon />}
              size="sm"
              variant="outline"
              onClick={() => navigate('/pedidos')}
            />
          </Tooltip>

          <Tabs variant="unstyled" defaultIndex={0}>
            <TabList>
              <AccentTab label="Ítems" count={items.length} underline={underline} pillBg={pillBg} pillColor={pillColor} />
              <AccentTab label="Automatizaciones" count={0} underline={underline} pillBg={pillBg} pillColor={pillColor} disabled />
            </TabList>
          </Tabs>
        </HStack>

        {/* RIGHT: actions */}
        <HStack spacing="2" justify="flex-end">
          {/* Submit (regular users while draft) */}
          {showSubmit && (
            <Tooltip label="Enviar pedido">
              {compact ? (
                <IconButton
                  aria-label="Enviar pedido"
                  icon={<CheckIcon />}
                  colorScheme="blue"
                  onClick={handleSubmit}
                  isDisabled={submitting}
                  isLoading={submitting}
                />
              ) : (
                <Button
                  leftIcon={<CheckIcon />}
                  colorScheme="blue"
                  onClick={handleSubmit}
                  isDisabled={submitting}
                  isLoading={submitting}
                >
                  Enviar
                </Button>
              )}
            </Tooltip>
          )}

          {/* Approve (only managers & not approved) */}
          {showApprove && (
            <Tooltip label="Aprobar pedido">
              {compact ? (
                <IconButton
                  aria-label="Aprobar pedido"
                  icon={<CheckIcon />}
                  colorScheme={accent}
                  onClick={handleApprove}
                  isDisabled={approving}
                  isLoading={approving}
                />
              ) : (
                <Button
                  leftIcon={<CheckIcon />}
                  colorScheme={accent}
                  onClick={handleApprove}
                  isDisabled={approving}
                  isLoading={approving}
                >
                  Aprobar
                </Button>
              )}
            </Tooltip>
          )}

          {/* Save */}
          <Tooltip label={dirtyCount ? `Guardar cambios (${dirtyCount})` : (canEdit ? 'Nada por guardar' : 'Pedido aprobado')}>
            {compact ? (
              <IconButton
                aria-label="Guardar cambios"
                icon={<FiSave />}
                colorScheme={accent}
                onClick={saveAll}
                isDisabled={!canEdit || dirtyCount === 0 || saving}
                isLoading={saving}
              />
            ) : (
              <Button
                leftIcon={<FiSave />}
                colorScheme={accent}
                onClick={saveAll}
                isDisabled={!canEdit || dirtyCount === 0 || saving}
                isLoading={saving}
                variant={canEdit ? 'solid' : 'outline'}
              >
                Guardar{dirtyCount ? ` (${dirtyCount})` : ''}
              </Button>
            )}
          </Tooltip>

          {/* Delete order — opens alert dialog */}
          <Tooltip label={canEdit ? 'Eliminar pedido' : 'No se puede eliminar un pedido aprobado'}>
            {compact ? (
              <IconButton
                aria-label="Eliminar pedido"
                icon={<DeleteIcon />}
                colorScheme={accent}
                variant="solid"
                onClick={openDelete}
                isDisabled={!canEdit || deleting}
                isLoading={deleting}
              />
            ) : (
              <Button
                leftIcon={<DeleteIcon />}
                colorScheme={accent}
                variant="solid"
                onClick={openDelete}
                isDisabled={!canEdit || deleting}
                isLoading={deleting}
              >
                Eliminar
              </Button>
            )}
          </Tooltip>
        </HStack>
      </Stack>

      {/* Items panel */}
      <Box borderRadius="md" border="1px solid" borderColor={barBorder} bg={panelBg} p={{ base: 2, md: 3 }}>
        {/* Add item button at panel top-right */}
        <HStack justify="flex-end" mb="2">
          <Tooltip label={canEdit ? 'Agregar ítem' : 'Pedido aprobado'}>
            {compact ? (
              <IconButton
                aria-label="Agregar ítem"
                icon={<AddIcon />}
                colorScheme={accent}
                onClick={()=>setAdding(true)}
                isDisabled={!canEdit}
                size="sm"
              />
            ) : (
              <Button
                leftIcon={<AddIcon />}
                colorScheme={accent}
                onClick={()=>setAdding(true)}
                isDisabled={!canEdit}
                variant={canEdit ? 'solid' : 'outline'}
                size="sm"
              >
                Agregar ítem
              </Button>
            )}
          </Tooltip>
        </HStack>

        {loading && <Text color={muted} p="4">Cargando…</Text>}

        <Stack spacing="3">
          {items.map(it => (
            <Card key={it.id} variant="outline" bg="white" _dark={{ bg: 'gray.800' }}>
              <CardHeader pb="2">
                <HStack justify="space-between" align="start">
                  <Box>
                    <Heading size="lg" color={useColorModeValue(`${accent}.700`, `${accent}.200`)}>{it.descripcion}</Heading>
                    <Text fontSize="sm" color={muted}>Ref: {it.referencia}</Text>
                  </Box>
                  <IconButton
                    aria-label="Eliminar ítem"
                    icon={<DeleteIcon />}
                    size="sm"
                    variant="outline"
                    colorScheme={accent}
                    onClick={()=>removeItem(it.id)}
                    isDisabled={!canEdit}
                  />
                </HStack>
              </CardHeader>
              <CardBody pt="2">
                <HStack spacing="6" align="end" wrap="wrap">
                  <Box>
                    <Text fontSize="md" color={muted}>Cantidad</Text>
                    <NumberInput
                      value={it.cantidad}
                      min={0}
                      precision={2}
                      step={1}
                      onChange={(_,v)=>{
                        const val = isFinite(v)?v:0
                        setItems(prev=>prev.map(p=>p.id===it.id?{...p,cantidad:val}:p))
                        setDirtyIds(prev => new Set(prev).add(it.id))
                      }}
                      maxW="140px"
                      isDisabled={!canEdit}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </Box>

                  <Box>
                    <Text fontSize="md" color={muted}>Precio</Text>
                    <NumberInput
                      value={it.precio}
                      min={0}
                      step={1000}
                      onChange={(_,v)=>{
                        const val = isFinite(v)?v:0
                        setItems(prev=>prev.map(p=>p.id===it.id?{...p,precio:val}:p))
                        setDirtyIds(prev => new Set(prev).add(it.id))
                      }}
                      maxW="180px"
                      isDisabled={!canEdit}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </Box>

                  <Spacer />

                  <Box>
                    <Text fontSize="md" color={muted}>Subtotal</Text>
                    <Text fontWeight="semibold">
                      {money((Number(it.cantidad)||0)*(Number(it.precio)||0))}
                    </Text>
                  </Box>
                </HStack>
              </CardBody>
            </Card>
          ))}

          {(!loading && items.length===0) && (
            <Box bg="white" _dark={{ bg: 'gray.800' }} borderWidth="1px" rounded="md" p="10" textAlign="center" color={muted}>
              Este pedido no tiene ítems.
            </Box>
          )}
        </Stack>
      </Box>

      {/* Add Item Modal */}
      <AddItemModal
        isOpen={adding}
        onClose={()=>setAdding(false)}
        onAdded={load}
        pedidoId={id}
        orderItems={items}
        lock={!canEdit}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={closeDelete}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Eliminar pedido
            </AlertDialogHeader>

            <AlertDialogBody>
              ¿Seguro que deseas eliminar este pedido? Esta acción no se puede deshacer.
              Se eliminarán el pedido y todos sus ítems.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} variant="outline" colorScheme={accent} onClick={closeDelete}>
                Cancelar
              </Button>
              <Button colorScheme={accent} onClick={confirmDelete} ml={3} isLoading={deleting}>
                Eliminar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}

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

/* Item picker modal */
function AddItemModal({ isOpen, onClose, onAdded, pedidoId, orderItems = [], lock=false }){
  const { authedFetch } = useAuthedFetch()
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'
  const [rows,setRows] = useState([])
  const [q,setQ] = useState('')
  const [page,setPage] = useState(1)
  const [pageSize,setPageSize] = useState(5)
  const [qtyById,setQtyById] = useState({})
  const inputBg = useColorModeValue('blackAlpha.50','whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')

  const inThisOrder = useMemo(() => {
    const m = {}
    for (const it of orderItems) {
      if (!it.producto_id) continue
      m[it.producto_id] = (m[it.producto_id] || 0) + Number(it.cantidad || 0)
    }
    return m
  }, [orderItems])

  useEffect(()=>{
    async function load(){
      const r = await authedFetch(`/inventario/resumen?pedido_id=${pedidoId}`)
      const data = await r.json()
      setRows(Array.isArray(data)?data:[])
    }
    if(isOpen) load()
  },[isOpen, authedFetch, pedidoId])

  const fold = (v)=> (v??'').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()
  const filtered = useMemo(()=>{
    const s = fold(q); if(!s) return rows
    return rows.filter(p=> fold(p.descripcion).includes(s) || fold(p.referencia).includes(s) || fold(p?.caracteristicas?.color).includes(s))
  },[rows,q])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total/pageSize))
  const safePage = Math.min(page,totalPages)
  const start = (safePage-1)*pageSize
  const pageRows = filtered.slice(start, start+pageSize)

  async function add(prod){
    const base = Number((prod.cantidad_disponible ?? prod.cantidad_actual ?? 0))
    const mine = Number(inThisOrder[prod.id] || 0)
    const available = Math.max(0, base - mine)

    let cantidad = Number(qtyById[prod.id] || 0)
    if(cantidad<=0) return
    if (cantidad > available) cantidad = available

    const body = { producto_id: prod.id, cantidad, precio: Number(prod.precio_lista||0) }
    const r = await authedFetch(`/pedidos/${pedidoId}/items`, { method:'POST', body: JSON.stringify(body) })
    if(r.ok){ onAdded(); onClose() }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Agregar ítems</ModalHeader>
        <ModalBody>
          <HStack mb="4" align="center">
            <InputGroup maxW="560px">
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Buscar por descripción, referencia o color"
                value={q}
                onChange={e=>setQ(e.target.value)}
                variant="filled"
                bg={inputBg}
                borderColor={inputBorder}
                _hover={{ bg: inputBg }}
                _focus={{ bg: inputBg, borderColor: inputBorder }}
              />
            </InputGroup>
            <Spacer />
            <HStack>
              <Text fontSize="sm" color="gray.500">Mostrar</Text>
              <select
                value={pageSize}
                onChange={e=>setPageSize(Number(e.target.value))}
                style={{ border: '1px solid var(--chakra-colors-gray-200)', borderRadius: 6, padding: '6px 8px' }}
              >
                <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option>
              </select>
            </HStack>
          </HStack>

          <Stack spacing="4">
            {pageRows.map(p=>{
              const base = Number((p.cantidad_disponible ?? p.cantidad_actual ?? 0))
              const mine = Number(inThisOrder[p.id] || 0)
              const available = Math.max(0, base - mine)

              return (
                <Card key={p.id} variant="outline">
                  <CardHeader pb="2">
                    <HStack justify="space-between" align="start">
                      <Box>
                        <Heading size="lg" color={useColorModeValue(`${accent}.700`, `${accent}.200`)}>{p.descripcion}</Heading>
                        <Text fontSize="xs" color="gray.500">Ref: {p.referencia}</Text>
                      </Box>
                      <VStack spacing="0" align="flex-end">
                        <Text fontSize="xs" color="gray.500">Disponible</Text>
                        <Text fontWeight="semibold" size="lg" color={useColorModeValue(`${accent}.700`, `${accent}.200`)}>{available}</Text>
                      </VStack>
                    </HStack>
                  </CardHeader>
                  <CardBody pt="2">
                    <HStack justify="space-between" align="end">
                      <Box>
                        <Text fontSize="xs" color="gray.500">Cantidad</Text>
                        <NumberInput
                          value={qtyById[p.id] ?? 0}
                          min={0}
                          max={available}
                          onChange={(_,v)=>setQtyById(prev=>({...prev, [p.id]: isFinite(v)?v:0}))}
                          w="160px"
                          isDisabled={lock}
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </Box>
                      <Button leftIcon={<AddIcon />} colorScheme={accent} onClick={()=>add(p)} isDisabled={available<=0 || lock}>
                        Agregar
                      </Button>
                    </HStack>
                  </CardBody>
                </Card>
              )
            })}
          </Stack>

          {/* Centered pager */}
          <HStack mt="4" justify="center" spacing="6">
            <IconButton
              aria-label="Página anterior"
              icon={<ChevronLeftIcon />}
              variant="outline"
              size="sm"
              isDisabled={safePage <= 1}
              onClick={()=>setPage(p=>Math.max(1, p-1))}
            />
            <Text fontSize="sm" color="gray.600">
              Página {safePage} de {totalPages}
            </Text>
            <IconButton
              aria-label="Página siguiente"
              icon={<ChevronRightIcon />}
              variant="outline"
              size="sm"
              isDisabled={safePage >= totalPages}
              onClick={()=>setPage(p=>Math.min(totalPages, p+1))}
            />
          </HStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
