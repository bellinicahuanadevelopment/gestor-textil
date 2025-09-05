// Centralized color name → CSS color mapping (Spanish & English-friendly)
// Edit or extend this list to tune badge colors across the app.

function normalizeKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Normalized keys (accents removed, lowercase)
const NAME_TO_HEX = new Map(Object.entries({
  'negro': '#111827',
  'blanco': '#f9fafb',
  'gris': '#9ca3af',
  'gris jaspe': '#a3a3a3',
  'marfil': '#f2ead3',
  'beige': '#e7dcc5',

  'azul': '#2563eb',
  'azul oscuro': '#1e40af',
  'azul claro': '#93c5fd',
  'azul indigo': '#4f46e5',
  'indigo': '#4f46e5',

  'rojo': '#ef4444',
  'verde': '#22c55e',
  'amarillo': '#eab308',
  'morado': '#8b5cf6',
  'violeta': '#8b5cf6',
  'naranja': '#f97316',
  'rosa': '#f472b6',

  'cafe': '#92400e',
  'marron': '#92400e'
}))

export function colorToCss(name) {
  const key = normalizeKey(name)
  if (NAME_TO_HEX.has(key)) return NAME_TO_HEX.get(key)
  // Accept plain CSS color names (e.g., "red", "blue")
  if (/^[a-z]+$/.test(key)) return key
  // Fallback pastel gray
  return '#e5e7eb'
}

function toHex(color) {
  // #rrggbb already
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
  return named[color] || null
}

export function contrastTextFor(bg) {
  const hex = toHex(bg)
  if (!hex) return 'black'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? 'black' : 'white'
}

// Export normalization if you want to reuse it elsewhere
export const normColorKey = normalizeKey
