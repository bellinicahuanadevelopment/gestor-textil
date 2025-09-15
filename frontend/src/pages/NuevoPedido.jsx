import React, { useRef, useState, Suspense, lazy, useEffect } from 'react'
import {
  Box, Heading, Text, Stack, HStack, VStack, Input, Button,
  FormControl, FormLabel, Card, CardHeader, CardBody,
  NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
  useDisclosure, useToast, useColorModeValue, useBreakpointValue, IconButton, Spacer,
  Skeleton, SkeletonText, AlertDialog, AlertDialogBody, AlertDialogFooter,
  AlertDialogHeader, AlertDialogContent, AlertDialogOverlay, usePrefersReducedMotion
} from '@chakra-ui/react'
import {
  CheckIcon, ArrowBackIcon, ArrowForwardIcon, AddIcon,
  DownloadIcon, EmailIcon, DeleteIcon
} from '@chakra-ui/icons'
import { useAuthedFetchJson } from '../lib/api'
import { useThemePrefs } from '../theme/ThemeContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Lazy-load heavy modal for performance
const InventoryPickerModal = lazy(() => import('../components/InventoryPickerModal'))
import ClientSelect from '../components/ClientSelect'

/* Helpers */
function money(n) {
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0
    }).format(Number(n || 0))
  } catch { return `${n}` }
}

function TextDivider({ children }) {
  const line = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const txt = useColorModeValue('gray.600', 'gray.400')
  return (
    <HStack w="full" my="6" spacing="4" align="center" role="separator" aria-label={typeof children === 'string' ? children : 'Sección'}>
      <Box flex="1" h="1px" bg={line} />
      <Text fontSize="sm" color={txt} fontWeight="medium" lineHeight="1.45">
        {children}
      </Text>
      <Box flex="1" h="1px" bg={line} />
    </HStack>
  )
}

/* Always-horizontal, responsive stepper with a11y */
function Stepper({ step, accent }) {
  const grayLine = useColorModeValue('gray.200', 'whiteAlpha.300')
  const grayText = useColorModeValue('gray.700', 'gray.200')
  const dotBg = useColorModeValue('gray.200', 'whiteAlpha.300')
  const activeText = useColorModeValue(`${accent}.700`, `${accent}.200`)
  const lineActive = useColorModeValue(`${accent}.400`, `${accent}.500`)
  const dotActiveBg = useColorModeValue(`${accent}.500`, `${accent}.400`)
  const dotActiveColor = useColorModeValue('white', 'gray.900')

  const dotSize = useBreakpointValue({ base: '6', sm: '7', md: '8' })
  const labelSize = useBreakpointValue({ base: 'xs', sm: 'sm', md: 'md' })
  const gap = useBreakpointValue({ base: 2, sm: 3, md: 4 })

  const labels = [1, 2, 3]

  return (
    <HStack as="nav" aria-label="Progreso del pedido" w="full" align="center" spacing={gap} mb={4} role="list">
      {labels.map((index) => {
        const isDone = index < step
        const isActive = index === step
        return (
          <HStack key={index} flex="1" spacing={gap} minW={0} role="listitem">
            <HStack spacing={3} minW={0} maxW="full">
              <Box
                w={dotSize}
                h={dotSize}
                rounded="full"
                display="grid"
                placeItems="center"
                bg={isDone ? dotActiveBg : isActive ? 'transparent' : dotBg}
                borderWidth={isActive ? '2px' : '0'}
                borderColor={isActive ? lineActive : 'transparent'}
                color={isDone ? dotActiveColor : isActive ? activeText : grayText}
                fontWeight="semibold"
                flex="0 0 auto"
                aria-label={`Paso ${index}`}
                aria-current={isActive ? 'step' : undefined}
              >
                {isDone ? <CheckIcon boxSize="3.5" aria-hidden="true" /> : index}
              </Box>

              <Text
                fontSize={labelSize}
                fontWeight={isActive ? 'semibold' : 'medium'}
                color={isActive ? activeText : grayText}
                whiteSpace="nowrap"
                display={{ base: 'none', sm: 'inline' }}
                lineHeight="1.25"
              >
                {`Paso ${index}`}
              </Text>
            </HStack>

            {index < labels.length && (
              <Box flex="1" h="2px" bg={index < step ? lineActive : grayLine} aria-hidden="true" />
            )}
          </HStack>
        )
      })}
    </HStack>
  )
}

export default function NuevoPedido() {
  const authedFetchJson = useAuthedFetchJson()
  const queryClient = useQueryClient()
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'

  const toast = useToast()
  const [step, setStep] = useState(1)
  const [pedidoId, setPedidoId] = useState(null)

  const headingRef = useRef(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const smooth = prefersReducedMotion ? 'none' : 'box-shadow 200ms ease, border-color 200ms ease'

  const [form, setForm] = useState({
    cliente_id: null,
    cliente_nombre: '',
    cliente_telefono: '',
    direccion_entrega: '',
    fecha_entrega: ''
  })

  const compact = useBreakpointValue({ base: true, md: false })
  const picker = useDisclosure()

  useEffect(() => {
    if (headingRef.current) headingRef.current.focus()
  }, [step])

  // Tokens to match PedidoDetalle
  const headingColor = useColorModeValue('gray.800', 'gray.100')
  const muted = useColorModeValue('gray.600', 'gray.400')
  const hoverBg = useColorModeValue('blackAlpha.200', 'whiteAlpha.400')
  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')

  // -------- Query: order details (items, etc.) --------
  const {
    data: order,
    isLoading: isOrderLoading,
    isFetching: isOrderFetching,
    isError: isOrderError,
    error: orderError
  } = useQuery({
    queryKey: ['pedido', pedidoId],
    queryFn: () => authedFetchJson(`/pedidos/${pedidoId}`),
    enabled: !!pedidoId,
    placeholderData: (prev) => prev
  })

  const items = order?.items || []

  // Helper to optimistically adjust a single item in cache
  function patchItemInCache(itemId, patch) {
    queryClient.setQueryData(['pedido', pedidoId], (old) => {
      if (!old || !Array.isArray(old.items)) return old
      return {
        ...old,
        items: old.items.map(row => row.id === itemId ? { ...row, ...patch } : row)
      }
    })
  }

  // -------- Mutations --------
  const startOrder = useMutation({
    mutationFn: async () => {
      const now = new Date()
      const fecha_local = now.toISOString().slice(0, 10)
      const hora_local = now.toTimeString().slice(0, 5)
      return authedFetchJson('/pedidos/start', {
        method: 'POST',
        body: JSON.stringify({ ...form, fecha_local, hora_local })
      })
    },
    onSuccess: (data) => {
      setPedidoId(data?.pedido_id)
      setStep(2)
      toast({ title: 'Pedido creado', status: 'success' })
    },
    onError: (err) => {
      toast({ title: 'No se pudo crear el pedido', description: String(err?.message || err), status: 'error' })
    }
  })

  const addItem = useMutation({
    mutationFn: async ({ producto_id, referencia, cantidad }) => {
      return authedFetchJson(`/pedidos/${pedidoId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          producto_id,
          referencia,
          cantidad: Number(cantidad || 0)
        })
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] })
      await queryClient.invalidateQueries({ queryKey: ['inventario'] })
      toast({ title: 'Artículo agregado', status: 'success' })
    },
    onError: (err) => {
      toast({ title: 'No se pudo agregar', description: String(err?.message || err), status: 'error' })
    }
  })

  // IMPORTANT: do not invalidate the whole order after an inline update.
  const updateItem = useMutation({
    mutationFn: async ({ itemId, fields }) => {
      return authedFetchJson(`/pedidos/${pedidoId}/items/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(fields)
      })
    },
    onMutate: async ({ itemId, fields }) => {
      await queryClient.cancelQueries({ queryKey: ['pedido', pedidoId] })
      const previous = queryClient.getQueryData(['pedido', pedidoId])
      patchItemInCache(itemId, fields)
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['pedido', pedidoId], ctx.previous)
      toast({ title: 'No se pudo actualizar', description: String(err?.message || err), status: 'error' })
    },
    // no onSettled invalidate — prevents the list from flashing/skeleton
  })

  const removeItem = useMutation({
    mutationFn: async ({ itemId }) => {
      return authedFetchJson(`/pedidos/${pedidoId}/items/${itemId}`, { method: 'DELETE' })
    },
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: ['pedido', pedidoId] })
      const previous = queryClient.getQueryData(['pedido', pedidoId])
      queryClient.setQueryData(['pedido', pedidoId], (old) => {
        if (!old || !Array.isArray(old.items)) return old
        return { ...old, items: old.items.filter(r => r.id !== itemId) }
      })
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['pedido', pedidoId], ctx.previous)
      toast({ title: 'No se pudo eliminar', description: String(err?.message || err), status: 'error' })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] })
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
    }
  })

  const submitOrder = useMutation({
    mutationFn: async () => authedFetchJson(`/pedidos/${pedidoId}/submit`, { method: 'POST' }),
    onSuccess: () => {
      setStep(3)
      queryClient.invalidateQueries({ queryKey: ['pedidos', 'lista'] })
      queryClient.invalidateQueries({ queryKey: ['inventario'] })
    },
    onError: (err) => {
      toast({ title: 'No se pudo enviar', description: String(err?.message || err), status: 'error' })
    }
  })

  // destructive action confirmation (remove item)
  const [removeTarget, setRemoveTarget] = useState(null)

  const step1Valid =
    (form.cliente_id || form.cliente_nombre) &&
    form.cliente_telefono &&
    form.direccion_entrega &&
    form.fecha_entrega

  const primaryAction = step === 1 ? 'next' : step === 2 ? 'submit' : null

  return (
    <Box as="main">
      <Heading
        ref={headingRef}
        tabIndex={-1}
        size="xl"
        mb="4"
        lineHeight="1.2"
        letterSpacing="-0.02em"
      >
        Nuevo pedido
      </Heading>

      <Stepper step={step} accent={accent} />

      <HStack mb="6" spacing="3" flexWrap="wrap" align="center">
        {step > 1 && step !== 3 && (
          <>
            <IconButton
              aria-label="Atrás"
              icon={<ArrowBackIcon />}
              colorScheme={accent}
              onClick={() => setStep(step - 1)}
              display={{ base: 'inline-flex', md: 'none' }}
              size="md"
              variant="outline"
            />
            <Button
              variant="outline"
              colorScheme={accent}
              leftIcon={<ArrowBackIcon />}
              onClick={() => setStep(step - 1)}
              display={{ base: 'none', md: 'inline-flex' }}
            >
              Atrás
            </Button>
          </>
        )}

        <Spacer />

        {step === 1 && (
          <>
            <IconButton
              aria-label={pedidoId ? 'Continuar' : 'Siguiente'}
              icon={<ArrowForwardIcon />}
              colorScheme={accent}
              onClick={() => startOrder.mutate()}
              isDisabled={!step1Valid || startOrder.isPending}
              isLoading={startOrder.isPending}
              display={{ base: 'inline-flex', md: 'none' }}
              size="md"
              variant={primaryAction === 'next' ? 'solid' : 'outline'}
            />
            <Button
              variant={primaryAction === 'next' ? 'solid' : 'outline'}
              colorScheme={accent}
              rightIcon={<ArrowForwardIcon />}
              onClick={() => startOrder.mutate()}
              isDisabled={!step1Valid || startOrder.isPending}
              isLoading={startOrder.isPending}
              display={{ base: 'none', md: 'inline-flex' }}
            >
              {pedidoId ? 'Continuar' : 'Siguiente'}
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <IconButton
              aria-label="Siguiente"
              icon={<ArrowForwardIcon />}
              colorScheme={accent}
              onClick={() => submitOrder.mutate()}
              isDisabled={items.length === 0 || submitOrder.isPending}
              isLoading={submitOrder.isPending}
              display={{ base: 'inline-flex', md: 'none' }}
              size="md"
              variant={primaryAction === 'submit' ? 'solid' : 'outline'}
            />
            <Button
              variant={primaryAction === 'submit' ? 'solid' : 'outline'}
              colorScheme={accent}
              rightIcon={<ArrowForwardIcon />}
              onClick={() => submitOrder.mutate()}
              isDisabled={items.length === 0 || submitOrder.isPending}
              isLoading={submitOrder.isPending}
              display={{ base: 'none', md: 'inline-flex' }}
            >
              Siguiente
            </Button>
          </>
        )}
      </HStack>

      {step === 1 && (
        <Stack spacing="4" maxW="720px">
          <FormControl isRequired>
            <FormLabel>Nombre del cliente</FormLabel>
            <ClientSelect
              value={form.cliente_id ? {
                id: form.cliente_id, nombre: form.cliente_nombre,
                telefono: form.cliente_telefono, direccion_entrega: form.direccion_entrega
              } : null}
              onChange={(c) => {
                setForm(f => ({
                  ...f,
                  cliente_id: c?.id || null,
                  cliente_nombre: c?.nombre || '',
                  cliente_telefono: f.cliente_telefono || c?.telefono || '',
                  direccion_entrega: f.direccion_entrega || c?.direccion_entrega || c?.direccion || ''
                }))
              }}
            />
          </FormControl>
          
          <FormControl isRequired>
            <FormLabel>Teléfono</FormLabel>
            <Input
              variant="filled"
              value={form.cliente_telefono}
              bg={inputBg}
              _hover={{ bg: hoverBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
              onChange={e => setForm(f => ({ ...f, cliente_telefono: e.target.value }))}
              inputMode="tel"
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Dirección de entrega</FormLabel>
            <Input
              variant="filled"
              value={form.direccion_entrega}
              bg={inputBg}
              _hover={{ bg: hoverBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
              onChange={e => setForm(f => ({ ...f, direccion_entrega: e.target.value }))}
            />
          </FormControl>

          <FormControl isRequired>
            <FormLabel>Fecha de entrega</FormLabel>
            <Input
              variant="filled"
              type="date"
              value={form.fecha_entrega}
              bg={inputBg}
              _hover={{ bg: hoverBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
              onChange={e => setForm(f => ({ ...f, fecha_entrega: e.target.value }))}
            />
          </FormControl>
        </Stack>
      )}

      {step === 2 && (
        <Box>
          {/* keep ONLY the text button */}
          <HStack mb="4" justify="flex-end">
            <Button
              colorScheme={accent}
              leftIcon={<AddIcon />}
              onClick={picker.onOpen}
              variant="outline"
            >
              Añadir artículo
            </Button>
          </HStack>

          {(isOrderLoading || isOrderFetching) && (
            <Stack spacing="4" aria-live="polite">
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

          {!isOrderLoading && !isOrderFetching && (
            <Stack spacing="4">
              {items.length === 0 ? (
                <Box borderWidth="1px" rounded="md" p="10" textAlign="center" color="gray.500">
                  Carrito vacío. Usa “Añadir artículo”.
                </Box>
              ) : (
                items.map(it => (
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
                          aria-label="Eliminar artículo"
                          icon={<DeleteIcon />}
                          size="sm"
                          variant="outline"
                          colorScheme="red"
                          onClick={() => setRemoveTarget(it)}
                        />
                      </HStack>
                    </CardHeader>

                    <CardBody pt="2">
                      <Stack
                        direction={{ base: 'column', md: 'row' }}
                        align={{ base: 'stretch', md: 'end' }}
                        spacing="2"
                      >
                        <Box>
                          <Text fontSize="md" color={muted} mb="1">Cantidad</Text>
                          <NumberInput
                            value={Number(it.cantidad) || 0}
                            min={0}
                            step={1}
                            precision={0}
                            onChange={(_, valNum) => {
                              const v = Number.isFinite(valNum) ? valNum : Number(it.cantidad) || 0
                              patchItemInCache(it.id, { cantidad: v })
                            }}
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              updateItem.mutate({
                                itemId: it.id,
                                fields: { cantidad: Number.isFinite(v) ? v : Number(it.cantidad) || 0 }
                              })
                            }}
                            maxW="160px"
                          >
                            <NumberInputField
                              textAlign="right"
                              fontFamily="mono"
                              sx={{ fontVariantNumeric: 'tabular-nums' }}
                              inputMode="numeric"
                              aria-label={`Cantidad para ${it.descripcion}`}
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
                            value={Number(it.precio) || 0}
                            min={0}
                            step={1000}
                            precision={0}
                            onChange={(_, valNum) => {
                              const v = Number.isFinite(valNum) ? valNum : Number(it.precio) || 0
                              patchItemInCache(it.id, { precio: v })
                            }}
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              updateItem.mutate({
                                itemId: it.id,
                                fields: { precio: Number.isFinite(v) ? v : Number(it.precio) || 0 }
                              })
                            }}
                            maxW="160px"
                          >
                            <NumberInputField
                              textAlign="right"
                              fontFamily="mono"
                              sx={{ fontVariantNumeric: 'tabular-nums' }}
                              inputMode="numeric"
                              aria-label={`Precio para ${it.descripcion}`}
                            />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                        </Box>

                        <Box
                          textAlign="right"
                          minW="160px"
                          ml={{ md: 'auto' }}
                          alignSelf={{ base: 'flex-end', md: 'auto' }}
                        >
                          <Text fontSize="md" color={muted}>Subtotal</Text>
                          <Text fontWeight="semibold" fontFamily="mono" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {money((Number(it.cantidad) || 0) * (Number(it.precio) || 0))}
                          </Text>
                        </Box>
                      </Stack>
                    </CardBody>
                  </Card>
                ))
              )}
            </Stack>
          )}

          <Suspense fallback={<Box p="4"><Text color="gray.500">Cargando buscador…</Text></Box>}>
            <InventoryPickerModal
              isOpen={picker.isOpen}
              onClose={picker.onClose}
              onAdd={(sel) => addItem.mutate(sel)}
              orderItems={items}
            />
          </Suspense>
        </Box>
      )}

      {step === 3 && (
        <VStack spacing="8" align="center" textAlign="center" mt={{ base: 2, md: 4 }}>
          <VStack spacing="4">
            <Box
              w="14" h="14"
              rounded="full"
              bg={useColorModeValue('green.50','green.900')}
              display="grid" placeItems="center"
              aria-hidden="true"
            >
              <CheckIcon color={useColorModeValue('green.500','green.300')} boxSize="6" />
            </Box>
            <Heading size="xl" lineHeight="1.2">Pedido enviado</Heading>
            <Text color={useColorModeValue('gray.600','gray.300')} maxW="72ch" lineHeight="1.45">
              Tu pedido ha sido creato y enviado para aprobación. En breve podrás ver su estado actualizado.
            </Text>
          </VStack>

          <TextDivider>Acciones</TextDivider>

          <HStack spacing="3" flexWrap="wrap" justify="center">
            <Button
              leftIcon={<AddIcon aria-hidden="true" />}
              colorScheme={accent}
              onClick={() => {
                setStep(1)
                setPedidoId(null)
                queryClient.removeQueries({ queryKey: ['pedido'], exact: false })
                setForm({
                  cliente_id: null,
                  cliente_nombre: '',
                  cliente_telefono: '',
                  direccion_entrega: '',
                  fecha_entrega: ''
                })
              }}
            >
              Crear otro
            </Button>
            <Button leftIcon={<DownloadIcon aria-hidden="true" />} variant="outline" colorScheme={accent}>
              Descargar
            </Button>
            <Button leftIcon={<EmailIcon aria-hidden="true" />} variant="outline" colorScheme={accent}>
              Notificar por correo
            </Button>
          </HStack>

          <Box w="full" maxW="900px">
            <Card variant="outline">
              <CardHeader pb="2">
                <HStack justify="space-between" align="start">
                  <Box>
                    <Heading size="md" lineHeight="1.2">Resumen del pedido</Heading>
                    <Text fontSize="sm" color={useColorModeValue('gray.600','gray.400')} lineHeight="1.45">
                      Ref: {pedidoId ? String(pedidoId).slice(0, 8).toUpperCase() : '—'}
                    </Text>
                  </Box>
                </HStack>
              </CardHeader>
              <CardBody pt="2">
                {(() => {
                  const totalItems = items.reduce((s, it) => s + Number(it.cantidad || 0), 0)
                  const totalPrice = items.reduce((s, it) => s + Number(it.cantidad || 0) * Number(it.precio || 0), 0)

                  const sample = items.slice(0, 3)
                    .map(it => `${Number(it.cantidad || 0)}× ${it.descripcion}`)
                    .join(' · ')
                  const more = items.length > 3 ? ` · +${items.length - 3} más` : ''

                  return (
                    <Stack spacing="3">
                      <HStack spacing="6" flexWrap="wrap">
                        <VStack align="start" spacing="0" minW="220px">
                          <Text fontSize="xs" color={useColorModeValue('gray.500','gray.400')}>Cliente</Text>
                          <Text fontWeight="semibold" lineHeight="1.3">{form.cliente_nombre || '—'}</Text>
                        </VStack>
                        <VStack align="start" spacing="0" minW="220px">
                          <Text fontSize="xs" color={useColorModeValue('gray.500','gray.400')}>Entrega</Text>
                          <Text fontWeight="semibold" lineHeight="1.3">
                            {form.fecha_entrega || '—'} · {form.direccion_entrega || '—'}
                          </Text>
                        </VStack>
                      </HStack>

                      <HStack spacing="6" flexWrap="wrap">
                        <VStack align="start" spacing="0" minW="220px">
                          <Text fontSize="xs" color={useColorModeValue('gray.500','gray.400')}>Artículos</Text>
                          <Text fontWeight="semibold" fontFamily="mono" sx={{ fontVariantNumeric: 'tabular-nums' }}>{totalItems}</Text>
                        </VStack>
                        <VStack align="start" spacing="0" minW="220px">
                          <Text fontSize="xs" color={useColorModeValue('gray.500','gray.400')}>Total</Text>
                          <Text fontWeight="semibold" fontFamily="mono" sx={{ fontVariantNumeric: 'tabular-nums' }}>{money(totalPrice)}</Text>
                        </VStack>
                      </HStack>

                      <VStack align="start" spacing="0">
                        <Text fontSize="xs" color={useColorModeValue('gray.500','gray.400')}>Detalle</Text>
                        <Text lineHeight="1.45">{sample}{more}</Text>
                      </VStack>
                    </Stack>
                  )
                })()}
              </CardBody>
            </Card>
          </Box>
        </VStack>
      )}

      <AlertDialog
        isOpen={!!removeTarget}
        leastDestructiveRef={undefined}
        onClose={() => setRemoveTarget(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Eliminar artículo
            </AlertDialogHeader>

            <AlertDialogBody>
              ¿Seguro que deseas eliminar “{removeTarget?.descripcion}” del pedido?
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setRemoveTarget(null)}>
                Cancelar
              </Button>
              <Button colorScheme="red" onClick={() => {
                if (removeTarget) removeItem.mutate({ itemId: removeTarget.id })
                setRemoveTarget(null)
              }} ml={3}>
                Eliminar
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  )
}
