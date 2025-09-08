import React from 'react';
import {
  Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody,
  SimpleGrid, Box, Text, HStack, VStack, useColorMode, Switch, Divider,
  IconButton, useColorModeValue
} from '@chakra-ui/react';
import { useThemePrefs } from '../theme/ThemeContext';
import { ACCENTS, FONT_OPTIONS } from '../theme/ThemeContext';

export default function ThemeDrawer({ isOpen, onClose }) {
  const { prefs, setPrefs } = useThemePrefs();
  const { colorMode, toggleColorMode } = useColorMode();
  const accent = prefs.accent || 'teal';

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const MIN = 0.85;
  const MAX = 1.30;
  const STEP = 0.05;

  const dec = () => setPrefs({ uiScale: clamp(Number((prefs.uiScale || 1) - STEP), MIN, MAX) });
  const inc = () => setPrefs({ uiScale: clamp(Number((prefs.uiScale || 1) + STEP), MIN, MAX) });
  const percent = Math.round((prefs.uiScale || 1) * 100);

  return (
    <Drawer
      isOpen={isOpen}
      placement="right"
      onClose={onClose}
      size={{ base: 'xs', md: 'sm' }}
      closeOnOverlayClick={true}
      returnFocusOnClose={false}
    >
      <DrawerOverlay />
      <DrawerContent
        w={{ base: '85vw', md: 'sm' }}
        maxW={{ base: '85vw', md: 'sm' }}
        h="100dvh"
        maxH="100dvh"
        borderLeftWidth="1px"
      >
        <DrawerHeader display="flex" alignItems="center" justifyContent="space-between">
          <Text>Temas</Text>
          <HStack>
            <Text fontSize="sm" color="gray.500">Oscuro</Text>
            <Switch
              isChecked={colorMode === 'dark'}
              onChange={() => {
                toggleColorMode();
                setPrefs({ colorMode: colorMode === 'dark' ? 'light' : 'dark' });
              }}
            />
          </HStack>
        </DrawerHeader>

        <DrawerBody overflowY="auto" pb="6">
          <VStack align="stretch" spacing={6}>
            <Box>
              <Text mb={3} fontSize="sm" color="gray.500">Paleta de Colores</Text>
              <SimpleGrid columns={6} spacing={3}>
                {ACCENTS.map(c => (
                  <Box
                    key={c}
                    as="button"
                    aria-label={c}
                    h="10"
                    w="10"
                    rounded="md"
                    borderWidth="1px"
                    borderColor={c === prefs.accent ? 'blackAlpha.600' : 'gray.200'}
                    boxShadow={c === prefs.accent ? '0 0 0 2px rgba(0,0,0,0.6) inset' : 'none'}
                    bg={`${c}.500`}
                    onClick={() => setPrefs({ accent: c })}
                  />
                ))}
              </SimpleGrid>
            </Box>

            <Divider />

            <Box>
              <Text mb={3} fontSize="sm" color="gray.500">Tipo de Letra</Text>
              <SimpleGrid columns={4} spacing={3}>
                {FONT_OPTIONS.map(f => {
                  const selected = prefs.font === f.id;
                  return (
                    <VStack
                      key={f.id}
                      as="button"
                      align="center"
                      spacing={1}
                      onClick={() => setPrefs({ font: f.id, fontStack: f.stack })}
                    >
                      <Box
                        h="16"
                        w="100%"
                        rounded="md"
                        borderWidth="1px"
                        borderColor={selected ? 'blackAlpha.700' : 'gray.200'}
                        boxShadow={selected ? '0 0 0 2px rgba(0,0,0,0.7) inset' : 'none'}
                        display="grid"
                        placeItems="center"
                      >
                        <Text fontFamily={f.stack} fontSize="2xl">Ag</Text>
                      </Box>
                      <Text fontSize="xs" color="gray.600">{f.label}</Text>
                    </VStack>
                  );
                })}
              </SimpleGrid>
            </Box>

            <Divider />

            <Box>
              <Text mb={3} fontSize="sm" color="gray.500">Curva</Text>
              <SimpleGrid columns={6} spacing={3}>
                {['none','xs','sm','md','lg','xl','2xl'].map(r => {
                  const selected = prefs.radius === r;
                  const demoRadius = r === 'xs' ? '2px'
                    : r === 'sm' ? '4px'
                    : r === 'md' ? '6px'
                    : r === 'lg' ? '10px'
                    : r === 'xl' ? '14px'
                    : r === '2xl' ? '18px' : '0';
                  return (
                    <VStack
                      key={r}
                      as="button"
                      spacing={1}
                      onClick={() => setPrefs({ radius: r })}
                    >
                      <Box
                        h="16"
                        w="100%"
                        rounded="md"
                        borderWidth="1px"
                        borderColor={selected ? 'blackAlpha.700' : 'gray.200'}
                        boxShadow={selected ? '0 0 0 2px rgba(0,0,0,0.7) inset' : 'none'}
                        position="relative"
                        bg="whiteAlpha.700"
                        _dark={{ bg: 'whiteAlpha.100' }}
                      >
                        <Box
                          position="absolute"
                          top="1"
                          right="1"
                          w="5"
                          h="5"
                          bg="red.400"
                          roundedTopRight={demoRadius}
                        />
                      </Box>
                      <Text fontSize="xs" color="gray.600">{r}</Text>
                    </VStack>
                  );
                })}
              </SimpleGrid>
            </Box>

            <Divider />

            {/* UI Size stepper */}
            <Box>
              <Text mb={3} fontSize="sm" color="gray.500">Tamaño</Text>
              <HStack>
                <IconButton
                  aria-label="Disminuir tamaño"
                  onClick={dec}
                  variant="outline"
                  bg={useColorModeValue('white','gray.800')}
                  borderColor={useColorModeValue('gray.300','whiteAlpha.300')}
                  rounded={prefs.radius}
                  size="sm"
                >
                  –
                </IconButton>
                <Text w="12" textAlign="center" fontWeight="semibold">{percent}%</Text>
                <IconButton
                  aria-label="Aumentar tamaño"
                  onClick={inc}
                  variant="outline"
                  bg={useColorModeValue('white','gray.800')}
                  borderColor={useColorModeValue('gray.300','whiteAlpha.300')}
                  rounded={prefs.radius}
                  size="sm"
                >
                  +
                </IconButton>
              </HStack>
              <Text mt="2" fontSize="xs" color="gray.500">
                Ajusta el tamaño general de la interfaz.
              </Text>
            </Box>
          </VStack>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
