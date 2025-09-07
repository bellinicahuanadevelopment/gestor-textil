import React, { useEffect, useState, forwardRef } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Collapse,
  Divider,
  Avatar,
  useColorModeValue,
  Link as ChakraLink,
  Tooltip,
  Button
} from '@chakra-ui/react'
import {
  ViewIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  AttachmentIcon,
  SettingsIcon,
  HamburgerIcon
} from '@chakra-ui/icons'
import { FiShoppingCart, FiPlusCircle } from 'react-icons/fi'
import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useThemePrefs } from '../theme/ThemeContext'

const RowWithIcon = forwardRef(function RowWithIcon(
  { children, leftIcon, isActive, hoverBg, activeBg, activeColor, color, onClick },
  ref
) {
  return (
    <HStack
      ref={ref}
      spacing="3"
      px="3"
      height="10"
      rounded="md"
      align="center"
      bg={isActive ? activeBg : 'transparent'}
      color={isActive ? activeColor : color}
      _hover={{ bg: isActive ? activeBg : hoverBg }}
      onClick={onClick}
      cursor={onClick ? 'pointer' : 'default'}
      userSelect="none"
    >
      <Box w="6" display="flex" alignItems="center" justifyContent="center">
        {leftIcon}
      </Box>
      {children}
    </HStack>
  )
})

function NavItem({ icon, children, to, isActive, onClick, rightIcon, showIconsOnly, accent }) {
  const hoverBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')
  const color = useColorModeValue('gray.700', 'gray.200')
  const activeBg = useColorModeValue(`${accent}.50`, `${accent}.900`)
  const activeColor = useColorModeValue(`${accent}.700`, `${accent}.200`)
  const label = typeof children === 'string' ? children : ''

  const row = (
    <RowWithIcon
      isActive={isActive}
      hoverBg={hoverBg}
      activeBg={activeBg}
      activeColor={activeColor}
      color={color}
      leftIcon={<Icon as={icon} boxSize="5" />}
      onClick={onClick}
    >
      {showIconsOnly ? null : (
        <>
          <Text fontWeight={isActive ? 'semibold' : 'medium'} fontSize="sm">
            {children}
          </Text>
          {rightIcon ? (
            <Box ml="auto">
              <Icon as={rightIcon} boxSize="4" />
            </Box>
          ) : null}
        </>
      )}
    </RowWithIcon>
  )

  const wrapped = showIconsOnly && label
    ? <Tooltip label={label} placement="right" openDelay={300}>{row}</Tooltip>
    : row

  if (to) {
    return (
      <ChakraLink as={Link} to={to} _hover={{ textDecoration: 'none' }}>
        {wrapped}
      </ChakraLink>
    )
  }
  return wrapped
}

export default function Sidebar({ collapsed, onToggleCollapse, isInDrawer, onOpenTheme }) {
  const { pathname } = useLocation()
  const [accountOpen, setAccountOpen] = useState(false)
  const [pendingOpenAccount, setPendingOpenAccount] = useState(false)
  const { user, logout } = useAuth()
  const { prefs } = useThemePrefs()

  const accent = prefs?.accent || 'teal'
  const bg = useColorModeValue('white', 'gray.800')
  const border = useColorModeValue('gray.200', 'whiteAlpha.300')
  const muted = useColorModeValue('gray.500', 'gray.400')
  const hoverBg = useColorModeValue('blackAlpha.50', 'whiteAlpha.100')

  const expandedWidth = '18rem'
  const collapsedWidth = '5rem'
  const animatedWidth = isInDrawer ? '100%' : (collapsed ? collapsedWidth : expandedWidth)

  const [showIconsOnly, setShowIconsOnly] = useState(collapsed)
  useEffect(() => {
    if (isInDrawer) setShowIconsOnly(false)
  }, [isInDrawer])

  useEffect(() => {
    if (collapsed) {
      setAccountOpen(false)
      setPendingOpenAccount(false)
    }
  }, [collapsed])

  const onAnimComplete = () => {
    if (!isInDrawer) {
      setShowIconsOnly(collapsed)
      if (!collapsed && pendingOpenAccount) {
        setPendingOpenAccount(false)
        setTimeout(() => setAccountOpen(true), 0)
      }
    }
  }

  function handleAvatarClick() {
    if (showIconsOnly) {
      setPendingOpenAccount(true)
      onToggleCollapse()
    } else {
      setAccountOpen(v => !v)
    }
  }

  return (
    <Box
      as={motion.div}
      animate={{ width: animatedWidth }}
      initial={{ width: animatedWidth }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      onAnimationComplete={onAnimComplete}
      bg={bg}
      borderRightWidth="1px"
      borderColor={border}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      p="4"
      h="100dvh"
      overflow="hidden"
    >
      <VStack spacing="4" align="stretch">
        {!isInDrawer && (
          <Box display={{ base: 'none', md: 'block' }}>
            <Tooltip label={showIconsOnly ? 'Expandir menú' : 'Colapsar menú'} placement="right" openDelay={300}>
              <RowWithIcon
                leftIcon={<Icon as={HamburgerIcon} boxSize="5" />}
                hoverBg={hoverBg}
                activeBg="transparent"
                activeColor="inherit"
                color="inherit"
                onClick={onToggleCollapse}
              >
                {showIconsOnly ? null : (
                  <Text fontSize="sm" color={muted}>Menú</Text>
                )}
              </RowWithIcon>
            </Tooltip>
          </Box>
        )}

        <RowWithIcon
          leftIcon={
            <Box w="8" h="8" rounded="full" bg={`${accent}.500`} display="grid" placeItems="center">
              <Text fontWeight="bold" color="white">G</Text>
            </Box>
          }
          hoverBg="transparent"
          activeBg="transparent"
          activeColor="inherit"
          color="inherit"
        >
          {showIconsOnly ? null : (
            <Text fontWeight="semibold" fontSize="lg" ml="1">Logo</Text>
          )}
        </RowWithIcon>

        <VStack align="stretch" spacing="1" mt="1">
          <NavItem
            icon={ViewIcon}
            to="/"
            isActive={pathname === '/'}
            showIconsOnly={showIconsOnly}
            accent={accent}
          >
            Inicio
          </NavItem>

          <NavItem
            icon={AttachmentIcon}
            to="/inventario"
            isActive={pathname === '/inventario'}
            showIconsOnly={showIconsOnly}
            accent={accent}
          >
            Inventario
          </NavItem>

          <NavItem
            icon={FiShoppingCart}
            to="/pedidos"
            isActive={pathname === '/pedidos'}
            showIconsOnly={showIconsOnly}
            accent={accent}
          >
            Pedidos
          </NavItem>

          <NavItem
            icon={FiPlusCircle}
            to="/pedidos/nuevo"
            isActive={pathname === '/pedidos/nuevo'}
            showIconsOnly={showIconsOnly}
            accent={accent}
          >
            Nuevo pedido
          </NavItem>

          <NavItem
            icon={SettingsIcon}
            to="/configuracion"
            isActive={pathname === '/configuracion'}
            showIconsOnly={showIconsOnly}
            accent={accent}
          >
            Configuración
          </NavItem>
        </VStack>
      </VStack>

      <Box mt="6">
        <Divider mb="3" />
        {showIconsOnly ? (
          <Box>
            <RowWithIcon
              leftIcon={
                <Avatar
                  size="sm"
                  name={user?.nombre_completo || 'Usuario'}
                  cursor="pointer"
                  onClick={handleAvatarClick}
                />
              }
              hoverBg={hoverBg}
              activeBg="transparent"
              activeColor="inherit"
              color="inherit"
            />
          </Box>
        ) : (
          <Box>
            <RowWithIcon
              leftIcon={
                <Avatar
                  size="sm"
                  name={user?.nombre_completo || 'Usuario'}
                  cursor="pointer"
                  onClick={handleAvatarClick}
                />
              }
              hoverBg={hoverBg}
              activeBg="transparent"
              activeColor="inherit"
              color="inherit"
              onClick={handleAvatarClick}
            >
              <Box display="flex" alignItems="center" w="full" justifyContent="space-between">
                <HStack>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold">{user?.nombre_completo || 'Usuario'}</Text>
                    <Text fontSize="xs" color={muted}>{user?.email || ''}</Text>
                  </Box>
                </HStack>
                <Icon as={accountOpen ? ChevronDownIcon : ChevronRightIcon} boxSize="4" color={muted} />
              </Box>
            </RowWithIcon>

            <Collapse in={accountOpen} animateOpacity>
              <VStack align="stretch" spacing="1" pl="8" pt="1" pb="1">
                <Button
                  size="sm"
                  variant="ghost"
                  colorScheme={accent}
                  justifyContent="flex-start"
                  leftIcon={<SettingsIcon />}
                  onClick={onOpenTheme}
                >
                  Tema y apariencia
                </Button>
                <Button size="sm" variant="ghost" colorScheme="red" justifyContent="flex-start" onClick={logout}>
                  Cerrar sesión
                </Button>
              </VStack>
            </Collapse>
          </Box>
        )}
      </Box>
    </Box>
  )
}
