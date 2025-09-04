import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerCloseButton,
  Stack, FormLabel, Select, Slider, SliderTrack, SliderFilledTrack, SliderThumb,
  RadioGroup, Radio, HStack, Button, Switch, Text, useToast
} from '@chakra-ui/react'
import { useThemePrefs } from '../theme/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useAuthedFetch } from '../lib/api'

const accents = ['teal','blue','green','purple','red','orange','cyan','pink']
const fonts = ['Inter','System','Montserrat','Arial','Roboto']
const radii = ['sm','md','lg','xl','2xl']

export default function ThemeDrawer({ isOpen, onClose }) {
  const { prefs, updatePrefs } = useThemePrefs()
  const { isAuthenticated } = useAuth()
  const { authedFetch } = useAuthedFetch()
  const toast = useToast()
  const saveTimer = useRef(null)
  const [local, setLocal] = useState(prefs)

  useEffect(() => { if (isOpen) setLocal(prefs) }, [isOpen, prefs])

  const scheduleSave = useCallback(() => {
    if (!isAuthenticated) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await authedFetch('/users/me/prefs', {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ prefs: local })
        })
        if (!res.ok) throw new Error()
        toast({ title:'Preferencias guardadas', status:'success', duration:1500 })
      } catch {
        toast({ title:'No se pudo guardar', status:'error', duration:2000 })
      }
    }, 600)
  }, [local, isAuthenticated])

  function setAndPersist(next) {
    setLocal(prev => ({ ...prev, ...next }))
    updatePrefs(next)      // actualiza tema en tiempo real
    scheduleSave()         // y lo persiste en la API si hay sesión
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} size="sm">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Configuración de Tema</DrawerHeader>
        <DrawerBody>
          <Stack spacing="5">
            <HStack justify="space-between">
              <FormLabel htmlFor="mode" m="0">Modo oscuro</FormLabel>
              <Switch id="mode"
                isChecked={local.colorMode === 'dark'}
                onChange={(e)=> setAndPersist({ colorMode: e.target.checked ? 'dark' : 'light' })}
              />
            </HStack>

            <div>
              <FormLabel>Color de acento</FormLabel>
              <Select value={local.accent} onChange={(e)=> setAndPersist({ accent: e.target.value })}>
                {accents.map(a => <option key={a} value={a}>{a}</option>)}
              </Select>
            </div>

            <div>
              <FormLabel>Fuente</FormLabel>
              <Select value={local.font} onChange={(e)=> setAndPersist({ font: e.target.value })}>
                {fonts.map(f => <option key={f} value={f}>{f}</option>)}
              </Select>
            </div>

            <div>
              <FormLabel>Tamaño de UI</FormLabel>
              <Slider min={0.9} max={1.2} step={0.05} value={local.uiScale}
                onChange={(v)=> setAndPersist({ uiScale: v })}>
                <SliderTrack><SliderFilledTrack /></SliderTrack>
                <SliderThumb />
              </Slider>
              <Text mt="1" fontSize="sm">Actual: {local.uiScale.toFixed(2)}x</Text>
            </div>

            <div>
              <FormLabel>Radio de bordes</FormLabel>
              <RadioGroup value={local.radius} onChange={(v)=> setAndPersist({ radius: v })}>
                <HStack>
                  {radii.map(r => <Radio key={r} value={r}>{r}</Radio>)}
                </HStack>
              </RadioGroup>
            </div>

            <Button onClick={onClose}>Cerrar</Button>
          </Stack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  )
}
