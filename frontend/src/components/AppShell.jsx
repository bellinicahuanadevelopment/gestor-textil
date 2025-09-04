import React from 'react'
import { Flex, Box, useDisclosure } from '@chakra-ui/react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ThemeDrawer from './ThemeDrawer'

export default function AppShell({ children }) {
  const themeDisc = useDisclosure()
  return (
    <Flex minH="100dvh" direction={{ base:'column', md:'row' }}>
      <Box display={{ base:'none', md:'block' }}>
        <Sidebar />
      </Box>
      <Flex direction="column" flex="1">
        <Topbar onOpenTheme={themeDisc.onOpen} />
        <Box as="main" p="4">
          {children}
        </Box>
      </Flex>
      <ThemeDrawer isOpen={themeDisc.isOpen} onClose={themeDisc.onClose} />
    </Flex>
  )
}
