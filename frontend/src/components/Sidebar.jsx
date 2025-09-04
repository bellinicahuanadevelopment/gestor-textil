import React from 'react'
import { Box, VStack, Link as ChakraLink, Text } from '@chakra-ui/react'
import { Link, useLocation } from 'react-router-dom'

export default function Sidebar() {
  const { pathname } = useLocation()
  const active = (p) => (pathname === p ? 'bold' : 'normal')

  return (
    <Box as="nav" w="72" maxW="72" bg="blackAlpha.50" _dark={{ bg:'whiteAlpha.100' }} p="4">
      <VStack align="stretch" spacing="3">
        <Text fontWeight="bold" fontSize="lg">Navegación</Text>
        <ChakraLink as={Link} to="/" fontWeight={active('/')}>Inicio</ChakraLink>
      </VStack>
    </Box>
  )
}
