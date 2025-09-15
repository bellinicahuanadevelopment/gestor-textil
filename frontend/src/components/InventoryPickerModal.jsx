import React, { useEffect, useMemo, useState, useRef } from 'react'
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Box, HStack, VStack, Text, Heading, Stack, Card, CardHeader, CardBody,
  NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper,
  Input, InputGroup, InputLeftElement, Select, IconButton, Button, Badge, Spacer,
  useColorModeValue, useBreakpointValue, Switch, Tooltip
} from '@chakra-ui/react'
import { SearchIcon, AddIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@chakra-ui/icons'
import { useAuthedFetchJson } from '../lib/api'
import { useThemePrefs } from '../theme/ThemeContext'

export default function InventoryPickerModal({
  isOpen,
  onClose,
  onAdd,
  pedidoId // optional; if provided, the list uses it to compute disponibilidad
}){
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'
  const authedFetchJson = useAuthedFetchJson()

  const hoverBg = useColorModeValue('blackAlpha.200', 'whiteAlpha.400')
  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const headerBg = useColorModeValue('white','gray.800')
  const borderColor = useColorModeValue('blackAlpha.200','whiteAlpha.300')
  const compact = useBreakpointValue({ base: true, md: false })

  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [qtyById, setQtyById] = useState({})
  const [addingId, setAddingId] = useState(null)
  const [flash, setFlash] = useState({}) // { [id]: true } for “Agregado ✓”
  const [keepOpen, setKeepOpen] = useState(() => {
    const v = localStorage.getItem('pickerKeepOpen')
    return v === null ? true : v === 'true'
  })

  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    async function load(){
      try{
        const url = pedidoId ? `/inventario/resumen?pedido_id=${pedidoId}` : '/inventario/resumen'
        const data = await authedFetchJson(url)
        if (!mountedRef.current) return
        setRows(Array.isArray(data) ? data : [])
      }catch{
        if (!mountedRef.current) return
        setRows([])
      }
    }
    if (isOpen) {
      // reset transient UI each open
      setQ('')
      setPage(1)
      setQtyById({})
      setAddingId(null)
      setFlash({})
      load()
    }
  }, [isOpen, pedidoId])

  function fold(v){
    return (v ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()
  }

  const filtered = useMemo(() => {
    const s = fold(q)
    if (!s) return rows
    return rows.filter(p =>
      fold(p.descripcion).includes(s) ||
      fold(p.referencia).includes(s) ||
      fold(p?.caracteristicas?.color).includes(s)
    )
  }, [rows, q])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageRows = filtered.slice(start, start + pageSize)


  function availableFor(row){
    // IMPORTANT: do not subtract “mine” again; cantidad_disponible is already the usable figure.
    return Number(row.cantidad_disponible ?? row.cantidad_actual ?? 0)
  }

  function setFlashFor(id){
    setFlash(prev => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setFlash(prev => {
        const n = { ...prev }
        delete n[id]
        return n
      })
    }, 1200)
  }

  async function addRow(row, { closeAfter = false } = {}){
    const qty = Number(qtyById[row.id] || 0)
    const avail = availableFor(row)
    if (!qty || qty <= 0) return
    const clamped = Math.max(0, Math.min(qty, avail))
    if (clamped === 0) return

    setAddingId(row.id)
    try{
      // Delegate to parent so we always use the merge-safe logic there
      await onAdd({
        producto_id: row.id,
        referencia: row.referencia,
        cantidad: clamped
      })

      // Local, optimistic availability update & inline confirmation
      setRows(prev =>
        prev.map(r => r.id === row.id
          ? { ...r, cantidad_disponible: Math.max(0, availableFor(r) - clamped) }
          : r
        )
      )
      setQtyById(prev => ({ ...prev, [row.id]: 0 }))
      setFlashFor(row.id)

      // Respect “mantener abierto” preference
      if (closeAfter || !keepOpen) onClose()
    } finally {
      setAddingId(null)
    }
  }

  function onToggleKeepOpen(v){
    setKeepOpen(v)
    localStorage.setItem('pickerKeepOpen', String(v))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        {/* Sticky header with title, keep-open, search & page-size */}
        <ModalHeader
          bg={headerBg}
          borderBottom="1px solid"
          borderColor={borderColor}
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit'
          }}
          pb="3"
        >
          <VStack align="stretch" spacing="3">
            <HStack justify="space-between" align="center">
              <Text fontWeight="semibold">Seleccionar artículos</Text>
              <HStack spacing="3" align="center">
                <Text fontSize="sm" color="gray.500">Mantener abierto</Text>
                <Switch
                  isChecked={keepOpen}
                  onChange={(e) => onToggleKeepOpen(e.target.checked)}
                  colorScheme={accent}
                />
              </HStack>
            </HStack>

            <HStack align="center" spacing="3" flexWrap="wrap">
              <InputGroup maxW={{ base: '100%', md: '560px' }}>
                <InputLeftElement pointerEvents="none">
                  <SearchIcon color="gray.400" />
                </InputLeftElement>
                <Input
                  placeholder="Descripción, referencia o color"
                  value={q}
                  onChange={e=>{ setQ(e.target.value); setPage(1) }}
                  variant="filled"
                  bg={inputBg}
                  _hover={{ bg: hoverBg }}
                  _focus={{ bg: inputBg, borderColor: inputBorder }}
                />
              </InputGroup>
              <Spacer />
              <HStack>
                <Text fontSize="sm" color="gray.500">Mostrar</Text>
                <Select
                  value={pageSize}
                  onChange={e=>{ setPageSize(Number(e.target.value)); setPage(1) }}
                  size="sm"
                  w="84px"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                </Select>
              </HStack>
            </HStack>
          </VStack>
        </ModalHeader>

        <ModalBody>
          <Stack spacing="4">
            {pageRows.map(p => {
              const available = availableFor(p)
              const qty = Number(qtyById[p.id] || 0)
              const canAdd = qty > 0 && qty <= available
              const isAdding = addingId === p.id

              return (
                <Card key={p.id} variant="outline">
                  <CardHeader pb="2">
                    <HStack justify="space-between" align="start">
                      <Box>
                        <Heading size="lg">{p.descripcion}</Heading>
                        <Text fontSize="xs" color="gray.500">Ref: {p.referencia}</Text>
                      </Box>
                      <VStack spacing="0" align="flex-end">
                        <HStack>
                          <Text fontSize="xs" color="gray.500">Disponible</Text>
                          {flash[p.id] && (
                            <Badge colorScheme="green" rounded="md" ml="2">Agregado <CheckIcon ml="1" boxSize="2.5" /></Badge>
                          )}
                        </HStack>
                        <Text fontSize="lg" fontWeight="bold" fontFamily="mono" lineHeight="1">{available}</Text>
                      </VStack>
                    </HStack>
                  </CardHeader>

                  <CardBody pt="2">
                    <HStack justify="space-between" align="end" flexWrap="wrap" gap="3">
                      <Box>
                        <Text fontSize="xs" color="gray.500">Cantidad</Text>
                        <NumberInput
                          value={qty}
                          min={0}
                          max={available}
                          onChange={(_,v)=>setQtyById(prev=>({...prev, [p.id]: isFinite(v)?v:0}))}
                          w="160px"
                          fontFamily="mono"
                        >
                          <NumberInputField />
                          <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                          </NumberInputStepper>
                        </NumberInput>
                      </Box>

                      <HStack>
                        {compact ? (
                          <>
                            <Tooltip label="Añadir">
                              <IconButton
                                aria-label="Añadir"
                                icon={<AddIcon />}
                                colorScheme={accent}
                                onClick={()=>addRow(p)}
                                isDisabled={!canAdd || isAdding}
                                isLoading={isAdding}
                                size="sm"
                              />
                            </Tooltip>
                            <Tooltip label="Añadir y cerrar">
                              <IconButton
                                aria-label="Añadir y cerrar"
                                icon={<CheckIcon />}
                                colorScheme={accent}
                                variant="outline"
                                onClick={()=>addRow(p, { closeAfter:true })}
                                isDisabled={!canAdd || isAdding}
                                isLoading={isAdding}
                                size="sm"
                              />
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Button
                              leftIcon={<AddIcon />}
                              colorScheme={accent}
                              onClick={()=>addRow(p)}
                              isDisabled={!canAdd || isAdding}
                              isLoading={isAdding}
                            >
                              Añadir
                            </Button>
                            <Button
                              leftIcon={<CheckIcon />}
                              variant="outline"
                              colorScheme={accent}
                              onClick={()=>addRow(p, { closeAfter:true })}
                              isDisabled={!canAdd || isAdding}
                              isLoading={isAdding}
                            >
                              Añadir y cerrar
                            </Button>
                          </>
                        )}
                      </HStack>
                    </HStack>
                  </CardBody>
                </Card>
              )
            })}
          </Stack>

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

        <ModalFooter
          bg={headerBg}
          borderTop="1px solid"
          borderColor={borderColor}
          sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 1,
            borderBottomLeftRadius: 'inherit',
            borderBottomRightRadius: 'inherit'
          }}
        >
          <Button variant="ghost" leftIcon={<CloseIcon boxSize="2.5" />} onClick={onClose}>
            Cerrar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
