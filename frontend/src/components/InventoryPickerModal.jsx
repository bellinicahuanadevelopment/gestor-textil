import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, Button, Stack, Card, CardHeader, CardBody,
  Grid, Box, Text, Input, InputGroup, InputLeftElement, NumberInput, NumberInputField,
  HStack, Skeleton, useColorModeValue
} from '@chakra-ui/react'
import { SearchIcon } from '@chakra-ui/icons'
import { useAuthedFetch } from '../lib/api'
import { useThemePrefs } from '../theme/ThemeContext'

export default function InventoryPickerModal({ isOpen, onClose, onAdd }) {
  const { authedFetch } = useAuthedFetch()
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'
  const titleColor = useColorModeValue(`${accent}.700`, `${accent}.300`)

  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [qtyById, setQtyById] = useState({})

  const fetchRef = useRef(authedFetch)

  useEffect(() => { fetchRef.current = authedFetch }, [authedFetch])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetchRef.current('/inventario/resumen')
        const data = await res.json()
        setRows(Array.isArray(data) ? data : [])
      } finally {
        setLoading(false)
      }
    }
    if (isOpen) load()
  }, [isOpen])

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  }

  const filtered = useMemo(() => {
    if (!rows) return []
    const q = norm(query)
    if (!q) return rows
    return rows.filter(p => {
      const d = norm(p.descripcion)
      const r = norm(p.referencia)
      const c = norm(p?.caracteristicas?.color)
      return d.includes(q) || r.includes(q) || c.includes(q)
    })
  }, [rows, query])

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Agregar artículo</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <InputGroup mb="4">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              placeholder="Buscar por descripción, referencia o color"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>

          {loading ? (
            <Stack spacing="3">
              <Skeleton height="100px" />
              <Skeleton height="100px" />
            </Stack>
          ) : (
            <Stack spacing="3">
              {filtered.map(p => {
                const max = Number(p.cantidad_disponible || 0)
                const qty = qtyById[p.id] ?? (max > 0 ? 1 : 0)
                return (
                  <Card key={p.id} variant="outline">
                    <CardHeader pb="2">
                      <Grid templateColumns="1fr auto" gap="3" alignItems="start">
                        <Box>
                          <Text fontSize="lg" fontWeight="bold" color={titleColor}>{p.descripcion}</Text>
                          <Text fontSize="sm" color="gray.500">Ref: {p.referencia}</Text>
                        </Box>
                        <Box textAlign="right">
                          <Text fontSize="lg" fontWeight="bold">{max}</Text>
                          <Text fontSize="xs" color="gray.500">disponibles</Text>
                        </Box>
                      </Grid>
                    </CardHeader>
                    <CardBody pt="2">
                      <HStack justify="space-between">
                        <HStack>
                          <Text fontSize="sm" color="gray.500">Cantidad</Text>
                          <NumberInput
                            size="sm"
                            value={qty}
                            min={0}
                            max={max}
                            onChange={(_, n) => setQtyById(s => ({ ...s, [p.id]: isNaN(n) ? 0 : n }))}
                            w="120px"
                          >
                            <NumberInputField />
                          </NumberInput>
                        </HStack>
                        <Button
                          colorScheme={accent}
                          isDisabled={max <= 0 || qty <= 0}
                          onClick={() => onAdd({ producto_id: p.id, referencia: p.referencia, cantidad: qty })}
                        >
                          Añadir
                        </Button>
                      </HStack>
                    </CardBody>
                  </Card>
                )
              })}
            </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
