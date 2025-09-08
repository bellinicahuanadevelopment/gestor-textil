import React, { useEffect, useMemo, useState } from 'react'
import {
  Box, Heading, Stack, Card, CardHeader, CardBody, HStack, Text, Badge,
  Button, Input, InputGroup, InputLeftElement, Select, Spacer, useColorModeValue, IconButton,
  Skeleton, SkeletonText
} from '@chakra-ui/react'
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { useAuthedFetchJson } from '../lib/api'
import { useThemePrefs } from '../theme/ThemeContext'
import { Link } from 'react-router-dom'

function fold(v) {
  return (v ?? '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

export default function Pedidos() {
  const authedFetchJson = useAuthedFetchJson()
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'

  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const data = await authedFetchJson('/pedidos')
        setRows(Array.isArray(data) ? data : [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = fold(query)
    if (!q) return rows
    return rows.filter(p =>
      fold(p.cliente_nombre).includes(q) ||
      fold(p.direccion_entrega).includes(q) ||
      fold(p.status).includes(q)
    )
  }, [rows, query])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const end = Math.min(start + pageSize, total)
  const pageRows = filtered.slice(start, end)

  useEffect(() => { setPage(1) }, [query, pageSize])

  function statusColor(s) {
    if (s === 'draft') return 'gray'
    if (s === 'submitted') return 'blue'
    if (s === 'approved') return 'green'
    if (s === 'cancelled') return 'red'
    return 'gray'
  }

  function money(n) {
    try {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0))
    } catch { return `${n}` }
  }

  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const titleColor = useColorModeValue(`${accent}.700`, `${accent}.200`)
  const barBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const panelBg = useColorModeValue('transparent', 'transparent')

  const skeletonCards = Array.from({ length: pageSize })

  return (
    <Box>
      <HStack justify="space-between" align="center" mb="4">
        <Heading size="lg">Pedidos</Heading>
        <Button as={Link} to="/pedidos/nuevo" colorScheme={accent} variant="solid">Nuevo pedido</Button>
      </HStack>

      <HStack mb="4" align="center">
        <InputGroup maxW="500px">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Buscar por cliente, dirección o estado"
            value={query}
            onChange={e => setQuery(e.target.value)}
            variant="filled"
            bg={inputBg}
            _hover={{ bg: inputBg }}
            _focus={{ bg: inputBg, borderColor: inputBorder }}
          />
        </InputGroup>
        <Spacer />
        <HStack>
          <Text fontSize="sm" color="gray.500">Mostrar</Text>
          <Select
            value={pageSize}
            onChange={e => setPageSize(Number(e.target.value))}
            size="sm"
            w="72px"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </Select>
        </HStack>
      </HStack>

      <Box borderRadius="md" border="1px solid" borderColor={barBorder} bg={panelBg} p={{ base: 2, md: 3 }}>
        <Stack spacing="4">
          {loading ? (
            skeletonCards.map((_, i) => (
              <Card key={`s-${i}`} variant="outline">
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
                >
                  <CardHeader pb="2">
                    <HStack justify="space-between" align="start">
                      <Box>
                        <Heading size="lg" color={titleColor}>{p.cliente_nombre}</Heading>
                        <Text fontSize="sm" color="gray.500">{p.direccion_entrega}</Text>
                      </Box>
                      <Badge colorScheme={statusColor(p.status)} textTransform="none">{p.status}</Badge>
                    </HStack>
                  </CardHeader>
                  <CardBody pt="2">
                    <HStack justify="space-between" wrap="wrap">
                      <Text fontSize="sm" color="gray.600">Entrega: {p.fecha_entrega}</Text>
                      <HStack>
                        <Text fontSize="sm" color="gray.500">Ítems:</Text>
                        <Text fontWeight="semibold">{p.items_count}</Text>
                        <Text fontSize="sm" color="gray.500" ml="4">Total:</Text>
                        <Text fontWeight="semibold">{money(p.total)}</Text>
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
        <Text fontSize="sm" color="gray.600">
          {loading ? 'Cargando…' : (total === 0 ? '0' : `${start + 1}–${end}`) + ` de ${total}`}
        </Text>
        <HStack>
          <IconButton
            aria-label="Anterior"
            size="sm"
            icon={<ChevronLeftIcon />}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            isDisabled={loading || safePage <= 1}
            variant="outline"
            colorScheme={accent}
          />
          <Text fontSize="sm" minW="90px" textAlign="center">
            {loading ? '—' : `Página ${safePage} de ${totalPages}`}
          </Text>
          <IconButton
            aria-label="Siguiente"
            size="sm"
            icon={<ChevronRightIcon />}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            isDisabled={loading || safePage >= totalPages}
            variant="outline"
            colorScheme={accent}
          />
        </HStack>
      </HStack>
    </Box>
  )
}
