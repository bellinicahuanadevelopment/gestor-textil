import React, { useEffect, useRef, useState } from 'react'
import {
  Box, Input, InputGroup, InputLeftElement, InputRightElement, IconButton, Spinner,
  Popover, PopoverTrigger, PopoverContent, PopoverBody,
  List, ListItem, Text, useOutsideClick, useColorModeValue
} from '@chakra-ui/react'
import { CloseIcon, SearchIcon } from '@chakra-ui/icons'
import { useAuthedFetch } from '../lib/api'

function highlight(text, q) {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i === -1) return text
  const a = text.slice(0, i)
  const b = text.slice(i, i + q.length)
  const c = text.slice(i + q.length)
  return (
    <>
      {a}<Box as="mark" bg="yellow.200">{b}</Box>{c}
    </>
  )
}

/**
 * ClientSelect (combobox)
 * Props:
 *  - value: { id, nombre, telefono, direccion_entrega? }
 *  - onChange(client|null)
 *  - placeholder
 */
export default function ClientSelect({ value, onChange, placeholder = 'Nombre' }) {
  const { authedFetch } = useAuthedFetch()
  const [query, setQuery] = useState(value?.nombre || '')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState([])
  const boxRef = useRef(null)

  const bg = useColorModeValue('white', 'gray.800')
  const border = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')
  const hoverBg = useColorModeValue('blackAlpha.200', 'whiteAlpha.400')
  const inputBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const inputBorder = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')

  // Close & normalize when clicking outside
  useOutsideClick({
    ref: boxRef,
    handler: () => {
      // Close and normalize the field:
      // - If a value is selected, revert to it.
      // - If nothing is selected, clear whatever was typed.
      setOpen(false)
      const sel = (value?.nombre || '').trim()
      const typed = query.trim()
      if (value?.id) {
        if (typed !== sel) setQuery(sel)
      } else if (typed) {
        setQuery('')
      }
    }
  })

  // Keep input in sync if parent selection changes
  useEffect(() => { setQuery(value?.nombre || '') }, [value?.id])

  // Fetch options (debounced) when open and query present
  useEffect(() => {
    let alive = true
    const q = query.trim()
    if (!open || q.length < 1) { setOptions([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await authedFetch(`/clientes?q=${encodeURIComponent(q)}&limit=20`)
        const data = await res.json()
        if (!alive) return
        setOptions(Array.isArray(data) ? data : [])
      } catch {
        if (alive) setOptions([])
      } finally {
        if (alive) setLoading(false)
      }
    }, 180)
    return () => { alive = false; clearTimeout(timer) }
  }, [query, open, authedFetch])

  function select(opt) {
    onChange?.(opt || null)
    setOpen(false)
    setQuery(opt?.nombre || '')
  }

  return (
    <Box position="relative" ref={boxRef}>
      <Popover isOpen={open} placement="bottom-start" autoFocus={false} matchWidth>
        <PopoverTrigger>
          <InputGroup onFocus={() => setOpen(true)}>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              value={query}
              placeholder={placeholder}
              onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  // Same normalization as on outside click
                  setOpen(false)
                  const sel = (value?.nombre || '').trim()
                  const typed = query.trim()
                  if (value?.id) {
                    if (typed !== sel) setQuery(sel)
                  } else if (typed) {
                    setQuery('')
                  }
                }
              }}
              variant="filled"
              autoComplete="off"
              bg={inputBg}
              _hover={{ bg: hoverBg }}
              _focus={{ bg: inputBg, borderColor: inputBorder }}
            />
            <InputRightElement>
              {loading ? (
                <Spinner size="sm" />
              ) : value ? (
                <IconButton
                  aria-label="Limpiar"
                  icon={<CloseIcon boxSize="3" />}
                  size="sm"
                  variant="ghost"
                  onClick={() => { setQuery(''); select(null) }}
                />
              ) : null}
            </InputRightElement>
          </InputGroup>
        </PopoverTrigger>

        <PopoverContent bg={bg} borderColor={border} maxH="260px" overflow="auto">
          <PopoverBody p="0">
            <List>
              {options.map(opt => (
                <ListItem
                  key={opt.id}
                  px="3" py="2.5"
                  _hover={{ bg: hoverBg, cursor: 'pointer' }}
                  onClick={() => select(opt)}
                >
                  <Text fontWeight="medium">{highlight(opt.nombre || '', query)}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {opt.telefono ? `${opt.telefono} • ` : ''}{opt.ciudad || ''}{opt.pais ? `, ${opt.pais}` : ''}
                  </Text>
                </ListItem>
              ))}
              {!loading && options.length === 0 && query.trim() && (
                <ListItem px="3" py="3">
                  <Text fontSize="sm" color="gray.500">Sin resultados para “{query.trim()}”.</Text>
                </ListItem>
              )}
            </List>
          </PopoverBody>
        </PopoverContent>
      </Popover>
    </Box>
  )
}
