import React from 'react'
import {
  Flex,
  Text,
  IconButton,
  Avatar,
  HStack
} from '@chakra-ui/react'
import { HamburgerIcon } from '@chakra-ui/icons'
import { useAuth } from '../contexts/AuthContext'

export default function Topbar({ onOpenSidebar }) {
  const { user } = useAuth()

  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px="4"
      py="3"
      borderBottom="1px solid"
      bg="white"
      borderColor="blackAlpha.100"
      _dark={{ bg: 'gray.800', borderColor: 'whiteAlpha.300' }}
      gap="3"
    >
      <HStack spacing="3">
        <IconButton
          display={{ base: 'inline-flex', md: 'none' }}
          aria-label="Abrir menú"
          icon={<HamburgerIcon />}
          variant="ghost"
          onClick={onOpenSidebar}
        />
        <Text fontWeight="bold" fontSize="xl">Gestor Textil</Text>
      </HStack>

      <HStack spacing="3">
        <Avatar size="sm" name={user?.nombre_completo || 'Usuario'} />
      </HStack>
    </Flex>
  )
}
