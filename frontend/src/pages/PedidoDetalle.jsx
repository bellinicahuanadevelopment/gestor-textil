import React, { useMemo, useState, useRef } from 'react'
import {
  Box, Heading, Text, Stack, HStack, VStack, Card, CardBody, CardHeader, Button,
  IconButton, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper,
  NumberDecrementStepper, Spacer, Badge, Tabs, TabList, Tab, useColorModeValue,
  useToast, Tooltip, useBreakpointValue, Divider, Skeleton, SkeletonText,
  AlertDialog, AlertDialogBody, AlertDialogFooter, AlertDialogHeader,
  AlertDialogContent, AlertDialogOverlay, useDisclosure, usePrefersReducedMotion
} from '@chakra-ui/react'
import {
  ArrowBackIcon, DeleteIcon, AddIcon, CheckIcon
} from '@chakra-ui/icons'
import { FiSave } from 'react-icons/fi'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthedFetchJson } from '../lib/api'
import { useThemePrefs } from '../theme/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import InventoryPickerModal from '../components/InventoryPickerModal'

function money(n){try{return new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(Number(n||0))}catch{return `${n}`}}
const fmtTime = (d)=> new Intl.DateTimeFormat('es-CO',{hour:'2-digit',minute:'2-digit'}).format(d)
function formatRef(id){ if(!id) return '—'; const s=String(id); const short=s.includes('-')?s.split('-')[0]:s.slice(0,8); return short.toUpperCase() }

export default function PedidoDetalle(){
  const { id } = useParams()
  const navigate = useNavigate()
  const authedFetchJson = useAuthedFetchJson()
  const queryClient = useQueryClient()
  const { prefs } = useThemePrefs()
  const { user } = useAuth()
  const accent = prefs?.accent || 'teal'
  const toast = useToast()

  const [dirtyIds, setDirtyIds] = useState(() => new Set())
  const [approving, setApproving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const prefersReducedMotion = usePrefersReducedMotion()
  const smooth = prefersReducedMotion ? 'none' : 'border-color 150ms ease, box-shadow 150ms ease'

  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure()
  const { isOpen: adding, onOpen: openAdd, onClose: closeAdd } = useDisclosure()
  const cancelRef = useRef()

  const {
    data: order,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => authedFetchJson(`/pedidos/${id}`),
    enabled: !!id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
    placeholderData: (prev) => prev
  })

  const head = order?.pedido || null
  const items = Array.isArray(order?.items) ? order.items : []

  const isApprover = ['manager', 'admin'].includes(user?.profile)
  const isApproved = (status) => {
    const s = String(status || '').toLowerCase()
    return s === 'approved' || s === 'aprobado'
  }
  const isDraft = (status) => String(status||'').toLowerCase() === 'draft'
  const canEdit = head && !isApproved(head.status)

  function patchOrder(fn){
    queryClient.setQueryData(['pedido', id], (old) => (old ? fn(old) : old))
  }
  function patchItemInCache(itemId, patch){
    patchOrder((old) => {
      if (!Array.isArray(old.items)) return old
      return { ...old, items: old.items.map(r => r.id === itemId ? { ...r, ...patch } : r) }
    })
  }

  const updateItem = useMutation({
    mutationFn: async ({ itemId, fields }) => {
      return authedFetchJson(`/pedidos/${id}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(fields) })
    },
    onMutate: async ({ itemId, fields }) => {
      await queryClient.cancelQueries({ queryKey: ['pedido', id] })
      const previous = queryClient.getQueryData(['pedido', id])
      patchItemInCache(itemId, fields)
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['pedido', id], ctx.previous)
      toast({ status:'error', title:'No se pudo actualizar', description: String(err?.message || err) })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
    }
  })

  const removeItem = useMutation({
    mutationFn: async ({ itemId }) => authedFetchJson(`/pedidos/${id}/items/${itemId}`, { method:'DELETE' }),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: ['pedido', id] })
      const previous = queryClient.getQueryData(['pedido', id])
      patchOrder((old) => {
        if (!Array.isArray(old?.items)) return old
        return { ...old, items: old.items.filter(r => r.id !== itemId) }
      })
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['pedido', id], ctx.previous)
      toast({ status:'error', title:'No se pudo eliminar el ítem', description: String(err?.message || err) })
    },
    onSuccess: () => {
      toast({ status:'success', title:'Ítem eliminado' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
    }
  })

  const approve = useMutation({
    mutationFn: async () => authedFetchJson(`/pedidos/${id}/approve`, { method:'POST' }),
    onMutate: async () => {
      setApproving(true)
      await queryClient.cancelQueries({ queryKey: ['pedido', id] })
      const previous = queryClient.getQueryData(['pedido', id])
      const optimisticAt = new Date().toISOString()
      patchOrder((old) => {
        const p = old?.pedido ? { ...old.pedido, status:'approved', approved_at: optimisticAt } : old?.pedido
        return { ...old, pedido: p }
      })
      return { previous, optimisticAt }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['pedido', id], ctx.previous)
      toast({ status:'error', title:'No se pudo aprobar', description: String(err?.message || err) })
    },
    onSuccess: (data, _vars, ctx) => {
      const approvedAt = data?.pedido?.approved_at ? new Date(data.pedido.approved_at) : (ctx?.optimisticAt ? new Date(ctx.optimisticAt) : new Date())
      toast({ status:'success', title:'Pedido aprobado', description:`Aprobado a las ${fmtTime(approvedAt)}` })
    },
    onSettled: () => {
      setApproving(false)
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos', 'lista'] })
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
    }
  })

  const submit = useMutation({
    mutationFn: async () => authedFetchJson(`/pedidos/${id}/submit`, { method:'POST' }),
    onMutate: async () => {
      setSubmitting(true)
      await queryClient.cancelQueries({ queryKey: ['pedido', id] })
      const previous = queryClient.getQueryData(['pedido', id])
      patchOrder((old) => {
        const p = old?.pedido ? { ...old.pedido, status:'submitted' } : old?.pedido
        return { ...old, pedido: p }
      })
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['pedido', id], ctx.previous)
      toast({ status:'error', title:'No se pudo enviar', description: String(err?.message || err) })
    },
    onSuccess: () => {
      toast({ status:'success', title:'Pedido enviado' })
    },
    onSettled: () => {
      setSubmitting(false)
      queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos', 'lista'] })
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
    }
  })

  const deleteOrder = useMutation({
    mutationFn: async () => authedFetchJson(`/pedidos/${id}`, { method:'DELETE' }),
    onMutate: () => setDeleting(true),
    onError: () => {
      toast({ status:'error', title:'No se pudo eliminar el pedido' })
      setDeleting(false)
    },
    onSuccess: () => {
      toast({ status:'success', title:'Pedido eliminado' })
      queryClient.removeQueries({ queryKey: ['pedido', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos', 'lista'] })
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
      closeDelete()
      navigate('/pedidos')
    }
  })

  async function saveAll(){
    if (dirtyIds.size === 0) return
    const snapshot = queryClient.getQueryData(['pedido', id])
    try {
      const dirty = (snapshot?.items || []).filter(i => dirtyIds.has(i.id))

      const existing = dirty.filter(i => !String(i.id).startsWith('tmp-'))
        .map(i => ({ itemId: i.id, fields: { cantidad: Number(i.cantidad||0), precio: Number(i.precio||0) } }))

      const stagedNew = dirty.filter(i => String(i.id).startsWith('tmp-'))
        .map(i => ({
          body: {
            producto_id: i.producto_id,
            referencia: i.referencia,
            cantidad: Number(i.cantidad||0),
            precio: Number(i.precio||0)
          }
        }))

      // PUT existing
      await Promise.all(existing.map(s => updateItem.mutateAsync(s)))
      // POST new
      await Promise.all(stagedNew.map(s => authedFetchJson(`/pedidos/${id}/items`, {
        method: 'POST',
        body: JSON.stringify(s.body)
      })))

      setDirtyIds(new Set())
      toast({ status:'success', title:`Cambios guardados (${dirty.length})` })
      await queryClient.invalidateQueries({ queryKey: ['pedido', id] })
      await queryClient.invalidateQueries({ queryKey: ['inventario'] })
    } catch (err) {
      toast({ status:'error', title:'Error al guardar cambios', description:String(err?.message || err) })
    }
  }

  const underline = useColorModeValue(`${accent}.500`, `${accent}.300`)
  const pillBg = useColorModeValue(`${accent}.50`, `${accent}.900`)
  const pillColor = useColorModeValue(`${accent}.700`, `${accent}.200`)
  const barBg = useColorModeValue('white','gray.800')
  const barBorder = useColorModeValue('blackAlpha.200','whiteAlpha.300')
  const muted = useColorModeValue('gray.600','gray.400')
  const panelBg = useColorModeValue('transparent', 'transparent')
  const headingColor = useColorModeValue('gray.800', 'gray.100')

  const dirtyCount = dirtyIds.size
  const compact = useBreakpointValue({ base: true, md: false })

  const showApprove = isApprover && head && !isApproved(head.status)
  const showSubmit = !isApprover && head && isDraft(head.status)

  const primary =
    showApprove ? 'approve' :
    (dirtyCount > 0 ? 'save' :
     (showSubmit ? 'submit' : null))

  // Stage new items from inventory picker and mark them dirty (require Save)
  function handleAddFromInventory(sel){
    // Build a temp row; use referencia as fallback label
    const tmpId = `tmp-${Math.random().toString(36).slice(2,9)}`
    const staged = {
      id: tmpId,
      producto_id: sel.producto_id,
      referencia: sel.referencia,
      descripcion: sel.referencia,
      cantidad: Number(sel.cantidad || 0),
      precio: Number(sel.precio || 0)
    }
    patchOrder(old => ({ ...old, items: Array.isArray(old.items) ? [...old.items, staged] : [staged] }))
    setDirtyIds(prev => {
      const s = new Set(prev)
      s.add(tmpId)
      return s
    })
    toast({ status:'info', title:'Ítem agregado', description:'Pendiente de guardar' })
  }

  const showHeaderSkeleton = isLoading && !head

  return (
    <Box as="main">
      <Heading size="lg" mb="1" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
        Pedido #{' '}
        {showHeaderSkeleton ? (
          <Skeleton as="span" display="inline-block" height="1em" width="64px" />
        ) : (
          head ? formatRef(head.id) : ''
        )}
      </Heading>

      {showHeaderSkeleton ? (
        <HStack spacing="3" mb="3" align="center">
          <Skeleton height="16px" width="220px" />
          <Skeleton height="16px" width="260px" />
          <Skeleton height="16px" width="160px" />
          <Skeleton height="20px" width="80px" rounded="full" />
        </HStack>
      ) : head && (
        <Text fontSize="sm" color={muted} mb="3" lineHeight="1.45">
          {head.cliente_nombre} • {head.direccion_entrega} • Entrega: {head.fecha_entrega}
          <Badge
            ml="3"
            colorScheme={(s => {
              const k = String(s||'').toLowerCase()
              if (k === 'draft') return 'gray'
              if (k === 'submitted') return 'blue'
              if (k === 'approved') return 'green'
              if (k === 'cancelled') return 'red'
              return 'gray'
            })(head.status)}
            textTransform="none"
            aria-label={`Estado: ${head.status}`}
          >
            <Box as="span" mr="1" w="2" h="2" rounded="full" bg="currentColor" display="inline-block" aria-hidden="true" />
            {head.status}
          </Badge>
        </Text>
      )}

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
        <HStack spacing="2" align="center">
          <Tooltip label="Volver a pedidos">
            <IconButton
              aria-label="Volver a pedidos"
              icon={<ArrowBackIcon />}
              size="sm"
              variant="ghost"
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

        <HStack spacing="2" justify="flex-end">
          {showSubmit && (
            <Tooltip label="Enviar pedido">
              {compact ? (
                <IconButton
                  aria-label="Enviar pedido"
                  icon={<CheckIcon />}
                  colorScheme={accent}
                  variant={primary === 'submit' ? 'solid' : 'outline'}
                  onClick={() => submit.mutate()}
                  isDisabled={submitting}
                  isLoading={submitting}
                  size="sm"
                />
              ) : (
                <Button
                  leftIcon={<CheckIcon />}
                  colorScheme={accent}
                  variant={primary === 'submit' ? 'solid' : 'outline'}
                  onClick={() => submit.mutate()}
                  isDisabled={submitting}
                  isLoading={submitting}
                  size="sm"
                >
                  Enviar
                </Button>
              )}
            </Tooltip>
          )}
        </HStack>
      </Stack>

      <Box borderRadius="md" border="1px solid" borderColor={barBorder} bg={panelBg} p={{ base: 2, md: 3 }}>
        <HStack justify="flex-end" mb="2" spacing="2">
          <Tooltip label={dirtyCount ? `Guardar cambios (${dirtyCount})` : (canEdit ? 'Nada por guardar' : 'Pedido aprobado')}>
            {compact ? (
              <IconButton
                aria-label="Guardar cambios"
                icon={<FiSave />}
                colorScheme={accent}
                onClick={saveAll}
                isDisabled={!canEdit || dirtyCount === 0}
                isLoading={updateItem.isPending}
                size="sm"
                variant={primary === 'save' ? 'solid' : 'outline'}
              />
            ) : (
              <Button
                leftIcon={<FiSave />}
                colorScheme={accent}
                onClick={saveAll}
                isDisabled={!canEdit || dirtyCount === 0}
                isLoading={updateItem.isPending}
                variant={primary === 'save' ? 'solid' : 'outline'}
                size="sm"
              >
                Guardar{dirtyCount ? ` (${dirtyCount})` : ''}
              </Button>
            )}
          </Tooltip>

          <Tooltip label={canEdit ? 'Eliminar pedido' : 'No se puede eliminar un pedido aprobado'}>
            {compact ? (
              <IconButton
                aria-label="Eliminar pedido"
                icon={<DeleteIcon />}
                colorScheme="red"
                variant="outline"
                onClick={openDelete}
                isDisabled={!canEdit || deleting}
                isLoading={deleting}
                size="sm"
              />
            ) : (
              <Button
                leftIcon={<DeleteIcon />}
                colorScheme="red"
                variant="outline"
                onClick={openDelete}
                isDisabled={!canEdit || deleting}
                isLoading={deleting}
                size="sm"
              >
                Eliminar
              </Button>
            )}
          </Tooltip>

          <Tooltip label={canEdit ? 'Agregar ítem' : 'Pedido aprobado'}>
            {compact ? (
              <IconButton
                aria-label="Agregar ítem"
                icon={<AddIcon />}
                colorScheme={accent}
                onClick={openAdd}
                isDisabled={!canEdit}
                size="sm"
                variant="outline"
              />
            ) : (
              <Button
                leftIcon={<AddIcon />}
                colorScheme={accent}
                onClick={openAdd}
                isDisabled={!canEdit}
                variant="outline"
                size="sm"
              >
                Agregar ítem
              </Button>
            )}
          </Tooltip>

          {showApprove && (
            <Tooltip label="Aprobar pedido">
              {compact ? (
                <IconButton
                  aria-label="Aprobar pedido"
                  icon={<CheckIcon />}
                  colorScheme={accent}
                  variant={primary === 'approve' ? 'solid' : 'outline'}
                  onClick={() => approve.mutate()}
                  isDisabled={approving}
                  isLoading={approving}
                  size="sm"
                />
              ) : (
                <Button
                  leftIcon={<CheckIcon />}
                  colorScheme={accent}
                  variant={primary === 'approve' ? 'solid' : 'outline'}
                  onClick={() => approve.mutate()}
                  isDisabled={approving}
                  isLoading={approving}
                  size="sm"
                >
                  Aprobar
                </Button>
              )}
            </Tooltip>
          )}
        </HStack>

        <Divider my="3" />

        {(isLoading || isFetching) && (
          <Stack spacing="3" aria-live="polite">
            {[0,1,2].map(i => (
              <Card key={`sk-${i}`} variant="outline" sx={{ transition: smooth }}>
                <CardHeader pb="2">
                  <HStack justify="space-between" align="start">
                    <Box w="full">
                      <Skeleton height="24px" maxW="240px" />
                      <SkeletonText mt="2" noOfLines={1} maxW="200px" />
                    </Box>
                    <Skeleton height="24px" width="80px" />
                  </HStack>
                </CardHeader>
                <CardBody pt="2">
                  <SkeletonText noOfLines={2} />
                </CardBody>
              </Card>
            ))}
          </Stack>
        )}

        {!isLoading && !isFetching && (
          <Stack spacing="3">
            {items.map(it => (
              <Card
                key={it.id}
                variant="outline"
                bg="white"
                _dark={{ bg: 'gray.800' }}
                _focusWithin={{ borderColor: `${accent}.400`, boxShadow: 'outline' }}
                sx={{ transition: smooth }}
              >
                <CardHeader pb="2">
                  <HStack justify="space-between" align="start">
                    <Box>
                      <Heading size="lg" color={headingColor} lineHeight="1.2" letterSpacing="-0.01em">
                        {it.descripcion}
                      </Heading>
                      <Text fontSize="sm" color={muted}>Ref: {it.referencia}</Text>
                    </Box>
                    <IconButton
                      aria-label="Eliminar ítem"
                      icon={<DeleteIcon />}
                      size="sm"
                      variant="outline"
                      colorScheme="red"
                      onClick={()=>removeItem.mutate({ itemId: it.id })}
                      isDisabled={!canEdit}
                    />
                  </HStack>
                </CardHeader>
                <CardBody pt="2">
                  <HStack spacing="6" align="end" wrap="wrap">
                    <Box>
                      <Text fontSize="md" color={muted} mb="1">Cantidad</Text>
                      <NumberInput
                        value={it.cantidad}
                        min={0}
                        precision={2}
                        step={1}
                        onChange={(_,v)=>{
                          const val = Number.isFinite(v)?v:0
                          patchItemInCache(it.id, { cantidad: val })
                          setDirtyIds(prev => new Set(prev).add(it.id))
                        }}
                        maxW="160px"
                        isDisabled={!canEdit}
                      >
                        <NumberInputField
                          textAlign="right"
                          fontFamily="mono"
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                          inputMode="decimal"
                          aria-label="Cantidad"
                        />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </Box>

                    <Box>
                      <Text fontSize="md" color={muted} mb="1">Precio</Text>
                      <NumberInput
                        value={it.precio}
                        min={0}
                        step={1000}
                        onChange={(_,v)=>{
                          const val = Number.isFinite(v)?v:0
                          patchItemInCache(it.id, { precio: val })
                          setDirtyIds(prev => new Set(prev).add(it.id))
                        }}
                        maxW="200px"
                        isDisabled={!canEdit}
                      >
                        <NumberInputField
                          textAlign="right"
                          fontFamily="mono"
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                          inputMode="decimal"
                          aria-label="Precio"
                        />
                        <NumberInputStepper>
                          <NumberIncrementStepper />
                          <NumberDecrementStepper />
                        </NumberInputStepper>
                      </NumberInput>
                    </Box>

                    <Spacer />

                    <Box textAlign="right" minW="160px">
                      <Text fontSize="md" color={muted}>Subtotal</Text>
                      <Text fontWeight="semibold" fontFamily="mono" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {money((Number(it.cantidad)||0)*(Number(it.precio)||0))}
                      </Text>
                    </Box>
                  </HStack>
                </CardBody>
              </Card>
            ))}

            {items.length===0 && (
              <Box bg="white" _dark={{ bg: 'gray.800' }} borderWidth="1px" rounded="md" p="10" textAlign="center" color={muted}>
                Este pedido no tiene ítems.
              </Box>
            )}
          </Stack>
        )}
      </Box>

      {/* Inventory Picker (replaces the old AddItemModal) */}
      <InventoryPickerModal
        isOpen={adding}
        onClose={closeAdd}
        onAdd={handleAddFromInventory}
        orderItems={items}
        pedidoId={id}
        defaultQty={0}
      />

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
              <Button colorScheme="red" onClick={() => deleteOrder.mutate()} ml={3} isLoading={deleting}>
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
