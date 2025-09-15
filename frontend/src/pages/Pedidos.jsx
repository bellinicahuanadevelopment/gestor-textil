import React, { useMemo, useState } from 'react'
import {
  Box, Heading, Stack, Card, CardHeader, CardBody, HStack, Text, Badge,
  Button, Input, InputGroup, InputLeftElement, Select, Spacer,
  useColorModeValue, IconButton, Skeleton, SkeletonText, Divider,
  useBreakpointValue, usePrefersReducedMotion
} from '@chakra-ui/react'
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, AddIcon } from '@chakra-ui/icons'
import { useThemePrefs } from '../theme/ThemeContext'
import { Link } from 'react-router-dom'
import { useOrdersQuery } from '../lib/hooks/useOrdersQuery'

/* Utils */
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
function statusColor(s) {
  const k = String(s || '').toLowerCase()
  if (k === 'draft') return 'gray'
  if (k === 'submitted') return 'blue'
  if (k === 'approved') return 'green'
  if (k === 'cancelled') return 'red'
  return 'gray'
}

export default function Pedidos() {
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'

  // Tokens consistent with PedidoDetalle
  const headingColor = useColorModeValue('gray.800', 'gray.100')
  const muted = useColorModeValue('gray.600', 'gray.400')
  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('blackAlpha.200', 'whiteAlpha.400')
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')

  const barBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const panelBg = useColorModeValue('transparent', 'transparent')
  const stickyBg = useColorModeValue('white', 'gray.900')

  const prefersReducedMotion = usePrefersReducedMotion()
  const transition = prefersReducedMotion ? 'none' : 'border-color 150ms ease, box-shadow 150ms ease'

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  // 1) Keep the list fresh
  const { data: rows = [], isLoading, isError, error } = useOrdersQuery({
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

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

  const skeletonCount = Math.max(3, Math.min(pageSize, 5))

  return (
    <Box as="main">
      {/* Title + primary action (unchanged) */}
      <HStack justify="space-between" align="center" mb="4">
        <Heading size="xl" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
          Pedidos
        </Heading>

        {compact ? (
          <Button
            as={Link}
            to="/pedidos/nuevo"
            colorScheme={accent}
            variant="solid"
            leftIcon={<AddIcon />}
          >
            Nuevo
          </Button>
        ) : (
          <Button
            as={Link}
            to="/pedidos/nuevo"
            colorScheme={accent}
            variant="solid"
            leftIcon={<AddIcon />}
          >
            Nuevo Pedido
          </Button>
        )}
      </HStack>

      <Box
        top="0"
        zIndex="1"
        borderBottom="1px solid"
        borderColor={barBorder}
        py="3"
        mb="3"
      >
        <HStack spacing="3" align="center" wrap="wrap">
          <InputGroup maxW="520px" flex="8">
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" aria-hidden="true" />
            </InputLeftElement>
            <Input
              aria-label="Cliente, dirección o ref."
              placeholder="Cliente, dirección o ref."
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1) }}
              variant="filled"
              bg={inputBg}
              _hover={{ bg: hoverBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
              lineHeight="1.45"
            />
          </InputGroup>

          <Spacer />

          <HStack>
            <Text fontSize="sm" color={muted}>Mostrar</Text>
            <Select
              aria-label="Cantidad de pedidos por página"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
              size="sm"
              h="40px"
              w="84px"
              variant="filled"
              bg={inputBg}
              _hover={{ bg: hoverBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </Select>
          </HStack>
        </HStack>
      </Box>

      {/* Container consistent with detail page */}
      <Box borderRadius="md" border="1px solid" borderColor={barBorder} bg={panelBg} p={{ base: 2, md: 3 }}>
        <Stack spacing="4">
          {/* 5) Loading skeletons */}
          {isLoading ? (
            Array.from({ length: skeletonCount }).map((_, i) => (
              <Card key={`s-${i}`} variant="outline" aria-busy="true" aria-live="polite">
                <CardHeader pb="2">
                  <HStack justify="space-between" align="start">
                    <Box w="full">
                      <Skeleton height="28px" maxW="300px" />
                      <SkeletonText mt="2" noOfLines={2} maxW="360px" />
                    </Box>
                    <Skeleton height="22px" width="80px" />
                  </HStack>
                </CardHeader>
                <CardBody pt="2">
                  <SkeletonText noOfLines={1} maxW="220px" />
                  <Divider my="3" />
                  <HStack justify="space-between" align="center">
                    <SkeletonText noOfLines={1} maxW="180px" />
                    <Skeleton height="20px" width="140px" />
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
              {/* 3) Card structure (clickable, status chip, right-aligned total) */}
              {pageRows.map(p => (
                <Card
                  key={p.id}
                  as={Link}
                  to={`/pedidos/${p.id}`}
                  role="link"
                  variant="outline"
                  cursor="pointer"
                  _hover={{ borderColor: `${accent}.300` }}
                  _focusWithin={{ borderColor: `${accent}.400`, boxShadow: 'outline' }} // keep your focus ring
                  sx={{ transition }}
                >
                  <CardHeader pb="2">
                    <HStack justify="space-between" align="start">
                      <Box>
                        <Heading size="lg" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
                          {p.cliente_nombre}
                        </Heading>
                        <Text fontSize="xs" color="gray.500" mt="0.5">Ref: {formatRef(p.id)}</Text>
                        {/* Puedes mostrar dirección u otros datos aquí si lo deseas */}
                      </Box>

                      {/* Status chip with dot, consistent with detail page */}
                      <Badge
                        colorScheme={statusColor(p.status)}
                        textTransform="none"
                        aria-label={`Estado: ${p.status}`}
                        alignSelf="start"
                      >
                        <Box as="span" mr="1" w="2" h="2" rounded="full" bg="currentColor" display="inline-block" aria-hidden="true" />
                        {p.status}
                      </Badge>
                    </HStack>
                  </CardHeader>

                  <CardBody pt="2">
                    <Stack spacing="3">
                      {/* Aquí va el resto del contenido del body (si lo hay) */}
                      {p.direccion_entrega ? (
                        <Text fontSize="sm" color={muted}>{p.direccion_entrega}</Text>
                      ) : null}

                      {/* Divider que separa del bloque Entrega/Total */}
                      <Divider />

                      <HStack justify="space-between" align="center" wrap="wrap">
                        <Text fontSize="sm" color={muted}>Entrega: {p.fecha_entrega}</Text>

                        <HStack spacing="2" minW="160px" justify="flex-end">
                          <Text fontSize="sm" color="gray.500">Total:</Text>
                          <Text
                            fontWeight="semibold"
                            fontFamily="mono"
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {money(p.total)}
                          </Text>
                        </HStack>
                      </HStack>
                    </Stack>
                  </CardBody>
                </Card>
              ))}

              {/* Empty state */}
              {pageRows.length === 0 && (
                <Box borderWidth="1px" rounded="md" p="10" textAlign="center" color={muted}>
                  <Stack spacing="4" align="center">
                    <Text>
                      {total === 0 ? 'No hay pedidos registrados.' : 'Sin resultados para tu búsqueda.'}
                    </Text>
                    <Button as={Link} to="/pedidos/nuevo" colorScheme={accent} leftIcon={<AddIcon />}>
                      Nuevo pedido
                    </Button>
                  </Stack>
                </Box>
              )}
            </>
          )}
        </Stack>
      </Box>

      {/* Pager (unchanged, wording consistent) */}
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
