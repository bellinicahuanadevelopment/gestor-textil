import React from 'react'
import {
  Flex, Text, IconButton, Avatar, Menu, MenuButton, MenuItem, MenuList, HStack, Button
} from '@chakra-ui/react'
import { SettingsIcon } from '@chakra-ui/icons'
import { useAuth } from '../contexts/AuthContext'

export default function Topbar({ onOpenTheme }) {
  const { user, logout } = useAuth()

  return (
    <Flex as="header" align="center" justify="space-between" px="4" py="3"
      borderBottom="1px solid" borderColor="blackAlpha.100" _dark={{ borderColor: 'whiteAlpha.300' }}>
      <Text fontWeight="bold" fontSize="xl">Gestor Textil</Text>
      <HStack spacing="3">
        <Button leftIcon={<SettingsIcon />} onClick={onOpenTheme} variant="outline">Tema</Button>
        <Menu>
          <MenuButton as={IconButton} aria-label="Usuario" variant="outline">
            <Avatar size="sm" name={user?.nombre_completo || 'Usuario'} />
          </MenuButton>
          <MenuList>
            <MenuItem disabled>{user?.nombre_completo || 'Usuario'}</MenuItem>
            <MenuItem onClick={logout}>Cerrar sesión</MenuItem>
          </MenuList>
        </Menu>
      </HStack>
    </Flex>
  )
}
