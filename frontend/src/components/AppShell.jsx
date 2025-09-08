import React, { useState } from 'react'
import {
  Flex,
  Box,
  useDisclosure,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  useColorModeValue,
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

  const shellBg = useColorModeValue('gray.50', 'gray.900')
  const topbarBg = useColorModeValue('white', 'gray.800')
  const borderColor = useColorModeValue('blackAlpha.200', 'whiteAlpha.300')

  return (
    <Flex minH="100dvh" direction={{ base: 'column', md: 'row' }} bg={shellBg}>
      {/* Desktop sidebar (sticky) */}
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
          onOpenTheme={() => { mobileSidebar.onClose(); themeDisc.onOpen(); }}
        />

      </Box>

      {/* Content column */}
      <Flex direction="column" flex="1" minW="0">
        {/* Sticky topbar */}
        <Box
          position="sticky"
          top="0"
          zIndex="sticky"
          bg={topbarBg}
          borderBottomWidth="1px"
          borderColor={borderColor}
        >
          <Topbar onOpenSidebar={mobileSidebar.onOpen} />
        </Box>

        <Box as="main" p="4">
          {children}
        </Box>
      </Flex>

      {/* Theme settings drawer */}
      <ThemeDrawer isOpen={themeDisc.isOpen} onClose={themeDisc.onClose} />

      {/* Mobile sidebar drawer */}
      <Drawer
        placement="left"
        isOpen={mobileSidebar.isOpen}
        onClose={mobileSidebar.onClose}
        size="xs"
      >
        <DrawerOverlay />
        <DrawerContent p="0">
          <Sidebar
            collapsed={false}
            onToggleCollapse={() => {}}
            isInDrawer={true}
            onOpenTheme={() => { mobileSidebar.onClose(); themeDisc.onOpen(); }}
            onNavigate={mobileSidebar.onClose}
          />


        </DrawerContent>
      </Drawer>
    </Flex>
  )
}
