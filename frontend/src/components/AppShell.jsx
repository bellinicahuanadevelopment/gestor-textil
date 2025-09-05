import React, { useState } from 'react'
import {
  Flex,
  Box,
  useDisclosure,
  Drawer,
  DrawerOverlay,
  DrawerContent
} from '@chakra-ui/react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ThemeDrawer from './ThemeDrawer'

export default function AppShell({ children }) {
  const themeDisc = useDisclosure()
  const mobileSidebar = useDisclosure()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  function toggleSidebarCollapse() {
    setSidebarCollapsed((v) => !v)
  }

  return (
    <Flex minH="100dvh" direction={{ base: 'column', md: 'row' }} bg="gray.50" _dark={{ bg: 'gray.900' }}>
      <Box
        display={{ base: 'none', md: 'block' }}
        position="sticky"
        top="0"
        h="100dvh"
        overflowY="auto"
        flexShrink={0}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
          onOpenTheme={themeDisc.onOpen}
        />
      </Box>

      <Flex direction="column" flex="1" minW="0">
        <Topbar onOpenSidebar={mobileSidebar.onOpen} />
        <Box as="main" p="4">
          {children}
        </Box>
      </Flex>

      <ThemeDrawer isOpen={themeDisc.isOpen} onClose={themeDisc.onClose} />

      <Drawer placement="left" isOpen={mobileSidebar.isOpen} onClose={mobileSidebar.onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent p="0">
          <Sidebar
            collapsed={false}
            onToggleCollapse={() => {}}
            isInDrawer={true}
            onOpenTheme={themeDisc.onOpen}
          />
        </DrawerContent>
      </Drawer>
    </Flex>
  )
}
