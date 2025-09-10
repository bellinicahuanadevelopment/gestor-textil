import React, { useMemo, useState } from 'react'
import {
  Box, Heading, Stack, Card, CardHeader, CardBody, HStack, Text, Badge,
  Button, Input, InputGroup, InputLeftElement, Select, Spacer,
  useColorModeValue, IconButton, Skeleton, SkeletonText,
  useBreakpointValue, FormControl, FormLabel, usePrefersReducedMotion
} from '@chakra-ui/react'
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, AddIcon } from '@chakra-ui/icons'
import { useThemePrefs } from '../theme/ThemeContext'
import { Link } from 'react-router-dom'
import { useOrdersQuery } from '../lib/hooks/useOrdersQuery'

function fold(v) {
  return (v ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function formatRef(id) {
  if (!id) return '—'
  const s = String(id)
  const short = s.includes('-') ? s.split('-')[0] : s.slice(0, 8)
  return short.toUpperCase()
}

function money(n) {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0))
  } catch { return `${n}` }
}

export default function Pedidos() {
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'

  const headingColor = useColorModeValue('gray.800', 'gray.100')
  const muted = useColorModeValue('gray.600', 'gray.400')
  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const barBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const panelBg = useColorModeValue('transparent', 'transparent')

  const prefersReducedMotion = usePrefersReducedMotion()
  const transition = prefersReducedMotion ? 'none' : 'border-color 150ms ease, box-shadow 150ms ease'

  const { data: rows = [], isLoading, isError, error } = useOrdersQuery()

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const compact = useBreakpointValue({ base: true, md: false })

  const filtered = useMemo(() => {
    const q = fold(query)
    if (!q) return rows
    return rows.filter(p =>
      fold(p.cliente_nombre).includes(q) ||
      fold(p.direccion_entrega).includes(q) ||
      fold(p.status).includes(q) ||
      fold(formatRef(p.id)).includes(q)
    )
  }, [rows, query])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const end = Math.min(start + pageSize, total)
  const pageRows = filtered.slice(start, end)

  function statusColor(s) {
    if (s === 'draft') return 'gray'
    if (s === 'submitted') return 'blue'
    if (s === 'approved') return 'green'
    if (s === 'cancelled') return 'red'
    return 'gray'
  }

  const skeletonCards = Array.from({ length: pageSize })

  return (
    <Box as="main">
      <HStack justify="space-between" align="center" mb="4">
        <Heading size="lg" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
          Pedidos
        </Heading>

        {compact ? (
          <IconButton
            as={Link}
            to="/pedidos/nuevo"
            aria-label="Crear pedido"
            icon={<AddIcon />}
            colorScheme={accent}
            variant="solid"
          />
        ) : (
          <Button
            as={Link}
            to="/pedidos/nuevo"
            colorScheme={accent}
            variant="solid"
            leftIcon={<AddIcon />}
          >
            Crear pedido
          </Button>
        )}
      </HStack>

      <HStack mb="4" spacing="3" align="end" wrap="wrap">
        <FormControl maxW="520px" flex="1">
          <FormLabel mb="1" fontSize="sm" color={muted}>Buscar</FormLabel>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" aria-hidden="true" />
            </InputLeftElement>
            <Input
              aria-label="Buscar por cliente, dirección, estado o referencia"
              placeholder="Cliente, dirección, estado o referencia"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1) }}
              variant="filled"
              bg={inputBg}
              _hover={{ bg: inputBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
              lineHeight="1.45"
            />
          </InputGroup>
        </FormControl>

        <Spacer />

        <FormControl w="auto">
          <FormLabel mb="1" fontSize="sm" color={muted}>Mostrar</FormLabel>
          <Select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            size="sm"
            w="84px"
            aria-label="Cantidad de pedidos por página"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </Select>
        </FormControl>
      </HStack>

      <Box borderRadius="md" border="1px solid" borderColor={barBorder} bg={panelBg} p={{ base: 2, md: 3 }}>
        <Stack spacing="4">
          {isLoading ? (
            skeletonCards.map((_, i) => (
              <Card key={`s-${i}`} variant="outline" aria-busy="true" aria-live="polite">
                <CardHeader pb="2">
                  <HStack justify="space-between" align="start">
                    <Box w="full">
                      <Skeleton height="28px" maxW="240px" />
                      <SkeletonText mt="2" noOfLines={1} maxW="300px" />
                    </Box>
                    <Skeleton height="22px" width="80px" />
                  </HStack>
                </CardHeader>
                <CardBody pt="2">
                  <HStack justify="space-between" wrap="wrap">
                    <SkeletonText noOfLines={1} maxW="200px" />
                    <HStack>
                      <SkeletonText noOfLines={1} maxW="220px" />
                    </HStack>
                  </HStack>
                </CardBody>
              </Card>
            ))
          ) : isError ? (
            <Box role="alert">
              <Text color="red.400" fontSize="sm">Error: {error?.message || 'Error al cargar pedidos'}</Text>
            </Box>
          ) : (
            <>
              {pageRows.map(p => (
                <Card
                  key={p.id}
                  as={Link}
                  to={`/pedidos/${p.id}`}
                  variant="outline"
                  cursor="pointer"
                  _hover={{ borderColor: `${accent}.300` }}
                  _focusWithin={{ borderColor: `${accent}.400`, boxShadow: 'outline' }}
                  sx={{ transition }}
                >
                  <CardHeader pb="2">
                    <HStack justify="space-between" align="start">
                      <Box>
                        <Heading size="lg" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
                          {p.cliente_nombre}
                        </Heading>
                        <Text fontSize="xs" color="gray.500">Ref: {formatRef(p.id)}</Text>
                        <Text fontSize="sm" color="gray.500">{p.direccion_entrega}</Text>
                      </Box>
                      <Badge colorScheme={statusColor(p.status)} textTransform="none" aria-label={`Estado: ${p.status}`}>
                        {p.status}
                      </Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody pt="2">
                    <HStack justify="space-between" wrap="wrap" align="baseline">
                      <Text fontSize="sm" color={muted}>Entrega: {p.fecha_entrega}</Text>
                      <HStack>
                        <Text fontSize="sm" color="gray.500">Ítems:</Text>
                        <Text
                          fontWeight="semibold"
                          fontFamily="mono"
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {p.items_count}
                        </Text>
                        <Text fontSize="sm" color="gray.500" ml="4">Total:</Text>
                        <Text
                          fontWeight="semibold"
                          fontFamily="mono"
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {money(p.total)}
                        </Text>
                      </HStack>
                    </HStack>
                  </CardBody>
                </Card>
              ))}

              {pageRows.length === 0 && (
                <Box borderWidth="1px" rounded="md" p="10" textAlign="center" color="gray.500">
                  {total === 0 ? 'No hay pedidos registrados.' : 'Sin resultados para tu búsqueda.'}
                </Box>
              )}
            </>
          )}
        </Stack>
      </Box>

      <HStack mt="6" justify="space-between" align="center" flexWrap="wrap" gap="3">
        <Text fontSize="sm" color={muted} role="status" aria-live="polite">
          {isLoading ? 'Cargando…' : (total === 0 ? '0' : `${start + 1}–${end}`) + ` de ${total}`}
        </Text>
        <HStack>
          <IconButton
            aria-label="Anterior"
            size="sm"
            icon={<ChevronLeftIcon />}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            isDisabled={isLoading || safePage <= 1}
            variant="outline"
            colorScheme={accent}
          />
          <Text fontSize="sm" minW="90px" textAlign="center">
            {isLoading ? '—' : `Página ${safePage} de ${totalPages}`}
          </Text>
          <IconButton
            aria-label="Siguiente"
            size="sm"
            icon={<ChevronRightIcon />}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            isDisabled={isLoading || safePage >= totalPages}
            variant="outline"
            colorScheme={accent}
          />
        </HStack>
      </HStack>
    </Box>
  )
}

function statusColor(s) {
  if (s === 'draft') return 'gray'
  if (s === 'submitted') return 'blue'
  if (s === 'approved') return 'green'
  if (s === 'cancelled') return 'red'
  return 'gray'
}
