import React, { useMemo, useState } from 'react'
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
  SkeletonText,
  Divider,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  IconButton,
  Button,
  Badge,
  Spacer,
  FormControl,
  FormLabel,
  useBreakpointValue,
  usePrefersReducedMotion,
  Tooltip,
} from '@chakra-ui/react'
import { SearchIcon, ChevronLeftIcon, ChevronRightIcon, AddIcon, RepeatIcon } from '@chakra-ui/icons'
import { Link } from 'react-router-dom'
import { useThemePrefs } from '../theme/ThemeContext'
import { useInventorySummaryQuery } from '../lib/hooks/useInventoryQuery'
import { useQueryClient } from '@tanstack/react-query'

export default function Inventario() {
  const { prefs } = useThemePrefs()
  const accent = prefs?.accent || 'teal'
  const queryClient = useQueryClient()

  const headingColor = useColorModeValue('gray.800', 'gray.100')
  const numberColor = useColorModeValue('gray.900', 'gray.100')
  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const hoverBg = useColorModeValue('blackAlpha.200', 'whiteAlpha.400')
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const barBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const panelBg = useColorModeValue('transparent', 'transparent')
  const muted = useColorModeValue('gray.600', 'gray.400')
  const stickyBg = useColorModeValue('white', 'gray.900')

  const compact = useBreakpointValue({ base: true, md: false })
  const prefersReducedMotion = usePrefersReducedMotion()
  const transition = prefersReducedMotion ? 'none' : 'border-color 150ms ease, box-shadow 150ms ease'

  // Load inventory via TanStack Query (already fresh per your hook)
  const { data: rowsData = [], isLoading, isError, error } = useInventorySummaryQuery()
  const rows = Array.isArray(rowsData) ? rowsData : []

  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  function norm(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  const filtered = useMemo(() => {
    const q = norm(query)
    if (!q) return rows
    return rows.filter(p => {
      const d = norm(p.descripcion)
      const r = norm(p.referencia)
      const color = norm(p?.caracteristicas?.color)
      return d.includes(q) || r.includes(q) || color.includes(q)
    })
  }, [rows, query])

  const total = filtered.length
  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const pageSafe = Math.min(page, lastPage)
  const startIdx = (pageSafe - 1) * pageSize
  const endIdx = Math.min(startIdx + pageSize, total)
  const pageRows = filtered.slice(startIdx, endIdx)

  const skeletonCount = Math.max(3, Math.min(pageSize, 5))

  const content = useMemo(() => {
    if (isLoading) {
      return (
        <Stack spacing="4" aria-busy="true" aria-live="polite">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <Card key={`sk-${i}`} variant="outline">
              <CardHeader pb="2">
                <HStack justify="space-between" align="start">
                  <Box w="full">
                    <Skeleton height="24px" maxW="240px" />
                    <SkeletonText mt="2" noOfLines={1} maxW="160px" />
                  </Box>
                  <Skeleton height="24px" width="56px" />
                </HStack>
              </CardHeader>
              <CardBody pt="2">
                <SkeletonText noOfLines={3} spacing="2" />
                <Divider my="3" />
                <HStack justify="flex-end">
                  <Skeleton height="18px" width="140px" />
                </HStack>
              </CardBody>
            </Card>
          ))}
        </Stack>
      )
    }
    if (isError) {
      return <Text color="red.400" fontSize="sm" role="alert">Error: {error?.message || 'Error al cargar el inventario'}</Text>
    }
    if (!pageRows || pageRows.length === 0) {
      return (
        <Box borderWidth="1px" rounded="md" p="10" textAlign="center" color={useColorModeValue('gray.600','gray.400')}>
          No hay productos en inventario.
          <Box mt="3">
            <Button
              leftIcon={<RepeatIcon />}
              size="sm"
              colorScheme={accent}
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['inventario'], exact: false })
                queryClient.invalidateQueries({ queryKey: ['inventario','resumen'], exact: false })
              }}
            >
              Actualizar
            </Button>
          </Box>
        </Box>
      )
    }
    return (
      <Stack spacing="4">
        {pageRows.map((p) => {
          const disponible = Math.trunc(Number((p.cantidad_disponible ?? p.cantidad_actual) || 0)) // integers only
          return (
            <Card
              key={p.id}
              variant="outline"
              w="full"
              _hover={{ borderColor: `${accent}.300` }}
              _focusWithin={{ borderColor: `${accent}.400`, boxShadow: 'outline' }}
              sx={{ transition }}
            >
              <CardHeader pb="2">
                <Grid templateColumns="1fr auto" alignItems="start" gap="3">
                  <Box>
                    <Heading size="lg" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
                      {p.descripcion}
                    </Heading>
                    <Text mt="1" fontSize="xs" color="gray.500">
                      Ref: {p.referencia}
                    </Text>
                  </Box>
                  <Box textAlign="right" minW="5rem">
                    <Text
                      fontSize="2xl"
                      fontWeight="semibold"
                      lineHeight="1"
                      color={numberColor}
                      fontFamily="mono"
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {disponible}
                    </Text>
                    <Text fontSize="xs" color="gray.500">Disponible</Text>
                  </Box>
                </Grid>
              </CardHeader>

              <CardBody pt="2">
                <Stack spacing="2">
                  <Box fontSize="sm">
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
  }, [isLoading, isError, error, pageRows, skeletonCount, accent, headingColor, numberColor, transition, queryClient])

  return (
    <Box as="main">
      <HStack justify="space-between" align="center" mb="4">
        <Heading size="xl" color={headingColor} lineHeight="1.2" letterSpacing="-0.02em">
          Inventario
        </Heading>
      </HStack>

      {/* Sticky controls row */}
      <Box

        top="0"
        zIndex="1"

        borderBottom="1px solid"
        borderColor={barBorder}
        py="3"
        mb="3"
      >
        <HStack spacing="3" align="end" wrap="wrap">
          <FormControl maxW="520px" flex="8">
            <InputGroup>
              <InputLeftElement pointerEvents="none">
                <SearchIcon color="gray.400" aria-hidden="true" />
              </InputLeftElement>
              <Input
                aria-label="Descripción, referencia o color"
                placeholder="Descripción, referencia o color"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                variant="filled"
                bg={inputBg}
                _hover={{ bg: hoverBg }}
                _focus={{ bg: inputBg, borderColor: inputBorder }}
                lineHeight="1.45"
              />
            </InputGroup>
          </FormControl>

          <Spacer />

          {/* Inline label to the left of the selector */}
          <FormControl as={HStack} w="auto" spacing="2" alignItems="center">
            <FormLabel htmlFor="inv-page-size" m="0" fontSize="sm" color={muted}>
              Mostrar
            </FormLabel>
            <Select
              id="inv-page-size"
              size="sm"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                setPage(1)
              }}
              variant="filled"
              width="84px"
              height="40px"
              bg={inputBg}
              _hover={{ bg: hoverBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
              aria-label="Cantidad de productos por página"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </Select>
          </FormControl>
        </HStack>
      </Box>

      {/* Content container (consistent with other pages) */}
      <Box
        borderRadius="md"
        border="1px solid"
        borderColor={barBorder}
        bg={panelBg}
        p={{ base: 2, md: 3 }}
      >
        {content}
      </Box>

      {/* Pager */}
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
          <HStack key={k} spacing="2" align="start">
            <Text w="48" maxW="48" noOfLines={1} color="gray.500">{label}</Text>
            <Text flex="1" noOfLines={2} whiteSpace="normal" wordBreak="break-word">
              {String(v)}
            </Text>
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
