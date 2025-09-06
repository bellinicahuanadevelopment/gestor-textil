// frontend/src/components/ApiDebugBadge.jsx
import { useState } from 'react'
import { Badge, Button, HStack, Text } from '@chakra-ui/react'
import { detectApiBase } from '../lib/api'

export default function ApiDebugBadge() {
  const base = detectApiBase()
  const [status, setStatus] = useState('idle')

  async function ping() {
    setStatus('…')
    try {
      const r = await fetch(base + '/health')
      const ok = r.ok
      setStatus(ok ? 'ok ✅' : `HTTP ${r.status}`)
    } catch (e) {
      setStatus('ERR')
      console.error('[api] /health ping failed:', e)
    }
  }

  return (
    <HStack spacing="2" fontSize="xs" mt="2" wrap="wrap">
      <Badge colorScheme="purple" variant="subtle">API: {base}</Badge>
      <Button size="xs" variant="outline" onClick={ping}>Ping /health</Button>
      <Text>{status}</Text>
    </HStack>
  )
}
