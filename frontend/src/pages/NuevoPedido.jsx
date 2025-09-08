import React, { useEffect, useState } from 'react'
import {
  Box, Heading, Text, Stack, HStack, VStack, Input, Button,
  FormControl, FormLabel, Card, CardHeader, CardBody,
  NumberInput, NumberInputField, useDisclosure, useToast,
  useColorModeValue, useBreakpointValue
} from '@chakra-ui/react'
import { CheckIcon } from '@chakra-ui/icons'
import { useAuthedFetchJson } from '../lib/api'
import { useThemePrefs } from '../theme/ThemeContext'
import InventoryPickerModal from '../components/InventoryPickerModal'
import ClientSelect from '../components/ClientSelect'


function Stepper({ step, accent }) {
  const labels = ['Paso 1', 'Paso 2', 'Paso 3']

  const grayLine = useColorModeValue('gray.200', 'whiteAlpha.300')
  const grayText = useColorModeValue('gray.700', 'gray.200')
  const dotBg = useColorModeValue('gray.200', 'whiteAlpha.300')
  const activeText = useColorModeValue(`${accent}.700`, `${accent}.200`)
  const lineActive = useColorModeValue(`${accent}.400`, `${accent}.500`)
  const dotActiveBg = useColorModeValue(`${accent}.500`, `${accent}.400`)
  const dotActiveColor = useColorModeValue('white', 'gray.900')

  const orientation = useBreakpointValue({ base: 'vertical', md: 'horizontal' })
  const dotSize = useBreakpointValue({ base: '6', md: '8' })
  const labelSize = useBreakpointValue({ base: 'sm', md: 'md' })
  const gap = useBreakpointValue({ base: 2, md: 4 })

  if (orientation === 'vertical') {
    return (
      <VStack align="stretch" spacing={2} mb={4} w="full">
        {labels.map((label, i) => {
          const index = i + 1
          const isDone = index < step
          const isActive = index === step
          return (
            <VStack key={label} align="stretch" spacing={1}>
              <HStack spacing={3}>
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
                >
                  {isDone ? <CheckIcon boxSize="3.5" /> : index}
                </Box>
                <Text
                  fontSize={labelSize}
                  fontWeight={isActive ? 'semibold' : 'medium'}
                  color={isActive ? activeText : grayText}
                >
                  {`Step ${index}`}
                </Text>
              </HStack>
              {index < labels.length && (
                <Box ml={dotSize} h="6" w="2px" bg={index < step ? lineActive : grayLine} />
              )}
            </VStack>
          )
        })}
      </VStack>
    )
  }

  return (
    <HStack w="full" align="center" spacing={gap} mb={4}>
      {labels.map((label, i) => {
        const index = i + 1
        const isDone = index < step
        const isActive = index === step
        return (
          <HStack key={label} flex="1" spacing={gap}>
            <HStack spacing={3} minW="0">
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
              >
                {isDone ? <CheckIcon boxSize="3.5" /> : index}
              </Box>
              <Text
                fontSize={labelSize}
                fontWeight={isActive ? 'semibold' : 'medium'}
                color={isActive ? activeText : grayText}
                whiteSpace="nowrap"
              >
                {`Step ${index}`}
              </Text>
            </HStack>

            {index < labels.length && (
              <Box flex="1" h="2px" bg={index < step ? lineActive : grayLine} />
            )}
          </HStack>
        )
      })}
    </HStack>
  )
}

export default function NuevoPedido() {
  const authedFetchJson = useAuthedFetchJson()
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'

  const toast = useToast()
  const [step, setStep] = useState(1)
  const [pedidoId, setPedidoId] = useState(null)
  const [items, setItems] = useState([])

  const [form, setForm] = useState({
    cliente_id: null,
    cliente_nombre: '',
    cliente_telefono: '',
    direccion_entrega: '',
    fecha_entrega: ''
  })


  const picker = useDisclosure()

  async function startOrder() {
    // If an order already exists in this flow, do NOT create a new one.
    if (pedidoId) {
      setStep(2)
      return
    }

    try {
      const now = new Date()
      const fecha_local = now.toISOString().slice(0, 10)
      const hora_local = now.toTimeString().slice(0, 5)
      const data = await authedFetchJson('/pedidos/start', {
        method: 'POST',
        body: JSON.stringify({ ...form, fecha_local, hora_local })
      })
      setPedidoId(data?.pedido_id)
      setStep(2)
      toast({ title: 'Pedido creado', status: 'success' })
    } catch (err) {
      toast({ title: 'No se pudo crear el pedido', description: String(err?.message || err), status: 'error' })
    }
  }




  async function loadOrder() {
    if (!pedidoId) return
    const data = await authedFetchJson(`/pedidos/${pedidoId}`)
    setItems(data.items || [])
  }


  useEffect(() => { loadOrder() }, [pedidoId])

  async function handleAddFromPicker(sel) {
    try {
      await authedFetchJson(`/pedidos/${pedidoId}/items`, {
        method: 'POST',
        body: JSON.stringify({ producto_id: sel.producto_id, cantidad: sel.cantidad })
      })
      await loadOrder()
      toast({ title: 'Ítem agregado', status: 'success' })
    } catch (err) {
      toast({ title: 'No se pudo agregar', description: String(err?.message || err), status: 'error' })
    }
  }


  async function updateItem(it, fields) {
    try {
      await authedFetchJson(`/pedidos/${pedidoId}/items/${it.id}`, {
        method: 'PUT',
        body: JSON.stringify(fields)
      })
      await loadOrder()
    } catch (err) {
      toast({ title: 'No se pudo actualizar', description: String(err?.message || err), status: 'error' })
    }
  }



  async function removeItem(it) {
    try {
      await authedFetchJson(`/pedidos/${pedidoId}/items/${it.id}`, { method: 'DELETE' })
      await loadOrder()
      toast({ title: 'Ítem eliminado', status: 'success' })
    } catch (err) {
      toast({ title: 'No se pudo eliminar', description: String(err?.message || err), status: 'error' })
    }
  }


  async function submitOrder() {
    try {
      await authedFetchJson(`/pedidos/${pedidoId}/submit`, { method: 'POST' })
      setStep(3)
    } catch (err) {
      toast({ title: 'No se pudo enviar', description: String(err?.message || err), status: 'error' })
    }
  }

  const step1Valid =
    (form.cliente_id || form.cliente_nombre) &&
    form.cliente_telefono &&
    form.direccion_entrega &&
    form.fecha_entrega

  return (
    <Box>
      <Heading size="lg" mb="4">Nuevo pedido</Heading>

      <Stepper step={step} accent={accent} />

      <HStack mb="6" spacing="3" flexWrap="wrap">
        {step > 1 && (
          <Button variant="solid" colorScheme={accent} onClick={() => setStep(step - 1)}>
            Atrás
          </Button>
        )}
        {step === 1 && (
          <Button
            variant="solid"
            colorScheme={accent}
            onClick={startOrder}
            isDisabled={!step1Valid}
          >
            {pedidoId ? 'Continuar' : 'Siguiente'}
          </Button>
        )}
        {step === 2 && (
          <Button
            variant="solid"
            colorScheme={accent}
            onClick={submitOrder}
            isDisabled={items.length === 0}
          >
            Siguiente
          </Button>
        )}
        {step === 3 && (
          <Button
            variant="solid"
            colorScheme={accent}
            onClick={() => {
              setStep(1)
              setPedidoId(null)
              setItems([])
              setForm({
                cliente_nombre: '',
                cliente_telefono: '',
                direccion_entrega: '',
                fecha_entrega: ''
              })
            }}
          >
            Crear otro
          </Button>
        )}
      </HStack>

      {step === 1 && (
        <Stack spacing="4" maxW="640px">
          <FormControl isRequired>
            <FormLabel>Nombre del cliente</FormLabel>
            <ClientSelect
              value={form.cliente_id ? { id: form.cliente_id, nombre: form.cliente_nombre, telefono: form.cliente_telefono, direccion_entrega: form.direccion_entrega } : null}
              onChange={(c) => {
                setForm(f => ({
                  ...f,
                  cliente_id: c?.id || null,
                  cliente_nombre: c?.nombre || '',
                  // Prefill phone/address if user hasn't typed anything yet
                  cliente_telefono: f.cliente_telefono || c?.telefono || '',
                  direccion_entrega: f.direccion_entrega || c?.direccion_entrega || c?.direccion || ''
                }))
              }}
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Teléfono de contacto</FormLabel>
            <Input variant="filled" value={form.cliente_telefono} onChange={e => setForm(f => ({ ...f, cliente_telefono: e.target.value }))} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Dirección de entrega</FormLabel>
            <Input variant="filled" value={form.direccion_entrega} onChange={e => setForm(f => ({ ...f, direccion_entrega: e.target.value }))} />
          </FormControl>
          <FormControl isRequired>
            <FormLabel>Fecha de entrega</FormLabel>
            <Input variant="filled" type="date" value={form.fecha_entrega} onChange={e => setForm(f => ({ ...f, fecha_entrega: e.target.value }))} />
          </FormControl>
        </Stack>
      )}

      {step === 2 && (
        <Box>
          <HStack mb="4" justify="flex-end">
            <Button colorScheme={accent} onClick={picker.onOpen}>Añadir artículo</Button>
          </HStack>

          <Stack spacing="4">
            {items.length === 0 ? (
              <Box borderWidth="1px" rounded="md" p="10" textAlign="center" color="gray.500">
                Carrito vacío. Usa “Añadir artículo”.
              </Box>
            ) : (
              items.map(it => (
                <Card key={it.id} variant="outline" w="full">
                  <CardHeader pb="2">
                    <HStack justify="space-between" align="start">
                      <Box>
                        <Heading size="lg">{it.descripcion}</Heading>
                        <Text fontSize="sm" color="gray.500">Ref: {it.referencia}</Text>
                      </Box>
                      <Box textAlign="right">
                        <Text fontSize="sm" color="gray.500">Cantidad</Text>
                        <NumberInput
                          size="sm"
                          defaultValue={Number(it.cantidad)}
                          min={1}
                          onBlur={(e) => updateItem(it, { cantidad: Number(e.target.value) })}
                          w="100px"
                        >
                          <NumberInputField />
                        </NumberInput>
                      </Box>
                    </HStack>
                  </CardHeader>
                  <CardBody pt="2">
                    <HStack justify="space-between">
                      <HStack>
                        <Text fontSize="sm" color="gray.500">Precio</Text>
                        <NumberInput
                          size="sm"
                          defaultValue={Number(it.precio)}
                          min={0}
                          onBlur={(e) => updateItem(it, { precio: Number(e.target.value) })}
                          w="120px"
                        >
                          <NumberInputField />
                        </NumberInput>
                      </HStack>
                      <Button variant="outline" colorScheme="red" onClick={() => removeItem(it)}>Eliminar</Button>
                    </HStack>
                  </CardBody>
                </Card>
              ))
            )}
          </Stack>

          <InventoryPickerModal
            isOpen={picker.isOpen}
            onClose={picker.onClose}
            onAdd={handleAddFromPicker}
          />
        </Box>
      )}

      {step === 3 && (
        <VStack spacing="3" align="start">
          <Heading size="lg">Pedido enviado</Heading>
          <Text color="gray.600">Tu pedido ha sido registrado correctamente y queda en estado de revisión.</Text>
        </VStack>
      )}
    </Box>
  )
}
