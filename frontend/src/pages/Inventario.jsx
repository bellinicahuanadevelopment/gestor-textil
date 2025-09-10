import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Stack,
  HStack,
  Grid,
  Skeleton,
  Divider,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  IconButton,
  Badge,
  Spacer,
  FormControl,
  FormLabel,
  usePrefersReducedMotion
} from '@chakra-ui/react'
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import { Link } from 'react-router-dom'
import { useAuthedFetchJson } from '../lib/api'
import { useThemePrefs } from '../theme/ThemeContext'

export default function Inventario() {
  const authedFetchJson = useAuthedFetchJson()
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'

  // Keep brand color reserved mainly for CTAs; use neutral for headings/content
  const headingColor = useColorModeValue('gray.800', 'gray.100')
  const numberColor = useColorModeValue('gray.900', 'gray.100')
  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const barBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const panelBg = useColorModeValue('transparent', 'transparent')
  const muted = useColorModeValue('gray.600', 'gray.400')

  const prefersReducedMotion = usePrefersReducedMotion()
  const transition = prefersReducedMotion ? 'none' : 'border-color 150ms ease, box-shadow 150ms ease'

  const mountedRef = useRef(false)

  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  useEffect(() => {
    mountedRef.current = true
    async function load() {
      try {
        if (!mountedRef.current) return
        setLoading(true)
        setError(null)
        const data = await authedFetchJson('/inventario/resumen')
        if (!mountedRef.current) return
        setRows(Array.isArray(data) ? data : [])
      } catch (err) {
        if (!mountedRef.current) return
        setError(err?.message || 'Error al cargar el inventario')
        setRows([])
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    }
    load()
    return () => { mountedRef.current = false }
  }, [])

  function norm(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  const filtered = useMemo(() => {
    if (!rows) return []
    const q = norm(query)
    if (!q) return rows
    return rows.filter(p => {
      const d = norm(p.descripcion)
      const r = norm(p.referencia)
      const color = norm(p?.caracteristicas?.color)
      return d.includes(q) || r.includes(q) || color.includes(q)
    })
  }, [rows, query])

  useEffect(() => { setPage(1) }, [query, pageSize])

  const total = filtered.length
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const pageSafe = Math.min(page, lastPage)
  const startIdx = (pageSafe - 1) * pageSize
  const endIdx = Math.min(startIdx + pageSize, total)
  const pageRows = filtered.slice(startIdx, endIdx)

  const content = useMemo(() => {
    if (loading) {
      return (
        <Stack spacing="4" aria-busy="true" aria-live="polite">
          <Skeleton height="120px" />
          <Skeleton height="120px" />
          <Skeleton height="120px" />
        </Stack>
      )
    }
    if (error) {
      return <Text color="red.400" fontSize="sm" role="alert">Error: {error}</Text>
    }
    if (!pageRows || pageRows.length === 0) {
      return <Text color="gray.500">No hay resultados.</Text>
    }
    return (
      <Stack spacing="4">
        {pageRows.map((p) => {
          const disponible = Number((p.cantidad_disponible ?? p.cantidad_actual) || 0)
          return (
            <Card
              key={p.id}
              variant="outline"
              w="full"
              _hover={{ borderColor: `${accent}.300` }}
              sx={{ transition }}
            >
              <CardHeader pb="2">
                <Grid templateColumns="1fr auto" alignItems="start" gap="3">
                  <Box>
                    <Heading size="lg" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
                      {p.descripcion}
                    </Heading>
                    <Text mt="1" fontSize="sm" color="gray.500" noOfLines={2} maxW="ch.75">
                      Ref: {p.referencia}
                    </Text>
                  </Box>
                  <Box textAlign="right" minW="5rem">
                    <Text
                      fontSize="2xl"
                      fontWeight="bold"
                      lineHeight="1.15"
                      color={numberColor}
                      fontFamily="mono"
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {disponible}
                    </Text>
                    <Text fontSize="xs" color="gray.500">disponible</Text>
                  </Box>
                </Grid>
              </CardHeader>

              <CardBody pt="2">
                <Stack spacing="2">
                  <Text fontSize="sm" color="gray.500">Características</Text>
                  <Box>
                    {renderCaracts(p.caracteristicas)}
                  </Box>
                  <Divider />
                </Stack>
              </CardBody>

              <CardFooter pt="0">
                <Stack w="full" spacing="0" align="flex-end">
                  <Text fontSize="xs" color="gray.500">Precio de lista</Text>
                  <Text
                    fontWeight="semibold"
                    fontFamily="mono"
                    sx={{ fontVariantNumeric: 'tabular-nums' }}
                    textAlign="right"
                  >
                    {formatMoney(p.precio_lista)}
                  </Text>
                </Stack>
              </CardFooter>
            </Card>
          )
        })}
      </Stack>
    )
  }, [loading, error, pageRows, accent, headingColor, numberColor, transition])

  return (
    <Box as="main">
      {/* Top bar: Title + Primary Action */}
      <HStack justify="space-between" align="center" mb="4">
        <Heading size="lg" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
          Inventario
        </Heading>

        {/* Primary action: clear, unmistakable CTA */}
        <IconButton
          as={Link}
          to="/inventario/movimientos/nuevo"
          aria-label="Registrar movimiento de inventario"
          colorScheme={accent}
          icon={<ChevronRightIcon />} // visually distinct; swap to a custom icon if you have one
          variant="solid"
        />
      </HStack>

      {/* Controls row with visible labels */}
      <HStack mb="4" spacing="3" align="end" wrap="wrap">
        <FormControl maxW="520px" flex="1">
          <FormLabel mb="1" fontSize="sm" color={muted}>Buscar</FormLabel>
          <InputGroup>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" aria-hidden="true" />
            </InputLeftElement>
            <Input
              aria-label="Buscar por descripción, referencia o color"
              placeholder="Descripción, referencia o color"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
            size="sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            width="84px"
            aria-label="Cantidad de productos por página"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </Select>
        </FormControl>
      </HStack>

      <Box
        borderRadius="md"
        border="1px solid"
        borderColor={barBorder}
        bg={panelBg}
        p={{ base: 2, md: 3 }}
      >
        {content}
      </Box>

      <HStack mt="4" justify="space-between" align="center" wrap="wrap" gap="3">
        <Text
          fontSize="sm"
          color={muted}
          role="status"
          aria-live="polite"
        >
          Mostrando {total === 0 ? 0 : startIdx + 1}–{endIdx} de {total}
        </Text>
        <HStack>
          <IconButton
            aria-label="Anterior"
            size="sm"
            icon={<ChevronLeftIcon />}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            isDisabled={pageSafe <= 1}
            variant="outline"
            colorScheme={accent}
          />
          <Text fontSize="sm" minW="90px" textAlign="center">
            Página {pageSafe} de {lastPage}
          </Text>
          <IconButton
            aria-label="Siguiente"
            size="sm"
            icon={<ChevronRightIcon />}
            onClick={() => setPage(p => Math.min(lastPage, p + 1))}
            isDisabled={pageSafe >= lastPage}
            variant="outline"
            colorScheme={accent}
          />
        </HStack>
      </HStack>
    </Box>
  )
}

function formatMoney(n) {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n || 0))
  } catch {
    return `${n}`
  }
}

function renderCaracts(obj) {
  if (!obj || typeof obj !== 'object') return <Text fontSize="sm">—</Text>
  const entries = Object.entries(obj)
  if (entries.length === 0) return <Text fontSize="sm">—</Text>

  return (
    <Stack spacing="1">
      {entries.map(([k, v]) => {
        const label = capitalize(k)
        if (normKey(k) === 'color') {
          const swatch = colorToCss(String(v))
          const textColor = contrastTextFor(swatch)
          return (
            <HStack key={k} spacing="2" align="center">
              <Text w="48" maxW="48" noOfLines={1} color="gray.500">{label}</Text>
              <Badge
                px="2.5"
                py="0.5"
                rounded="md"
                bg={swatch}
                color={textColor}
                borderWidth="1px"
                borderColor="blackAlpha.200"
              >
                {String(v)}
              </Badge>
            </HStack>
          )
        }
        return (
          <HStack key={k} spacing="2">
            <Text w="48" maxW="48" noOfLines={1} color="gray.500">{label}</Text>
            <Text flex="1" noOfLines={2}>{String(v)}</Text>
          </HStack>
        )
      })}
    </Stack>
  )
}

function capitalize(s) {
  const str = String(s || '')
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function normKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function colorToCss(name) {
  const n = normKey(name)
  const map = {
    'negro': '#111827',
    'blanco': '#f9fafb',
    'gris': '#9ca3af',
    'gris jaspe': '#a3a3a3',
    'marfil': '#f2ead3',
    'beige': '#e7dcc5',
    'azul': '#2563eb',
    'azul indigo': '#4f46e5',
    'azul índigo': '#4f46e5',
    'indigo': '#4f46e5',
    'rojo': '#ef4444',
    'verde': '#22c55e',
    'amarillo': '#eab308',
    'morado': '#8b5cf6',
    'violeta': '#8b5cf6',
    'cafe': '#92400e',
    'caf\u00e9': '#92400e',
    'marron': '#92400e',
    'marrón': '#92400e',
    'naranja': '#f97316',
    'rosa': '#f472b6'
  }
  if (map[n]) return map[n]
  if (/^[a-z]+$/.test(n)) return n
  return '#e5e7eb'
}

function contrastTextFor(bg) {
  const hex = toHex(bg)
  if (!hex) return 'black'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? 'black' : 'white'
}

function toHex(color) {
  if (/^#([0-9a-f]{6})$/i.test(color)) return color
  const named = {
    black: '#000000',
    white: '#ffffff',
    indigo: '#4f46e5',
    blue: '#2563eb',
    red: '#ef4444',
    green: '#22c55e',
    yellow: '#eab308',
    purple: '#8b5cf6',
    orange: '#f97316',
    pink: '#f472b6',
    gray: '#9ca3af'
  }
  const c = named[color]
  return c || null
}
