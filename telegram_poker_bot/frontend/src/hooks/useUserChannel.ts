/**
 * Phase 5: useUserChannel Hook
 * 
 * Optional personal channel for user-specific updates.
 * Currently a placeholder for future expansion.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { WebSocketManager } from '../services/WebSocketManager'
import type { ConnectionState, WebSocketMessage } from '../types/normalized'

interface UseUserChannelOptions {
  userId: number | string
  enabled?: boolean
}

interface UseUserChannelReturn {
  connectionState: ConnectionState
  isConnected: boolean
  reconnect: () => void
  lastMessage: WebSocketMessage | null
}

export function useUserChannel(options: UseUserChannelOptions): UseUserChannelReturn {
  const { userId, enabled = false } = options // Disabled by default

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  const wsManagerRef = useRef<WebSocketManager | null>(null)

  useEffect(() => {
    if (!enabled) return

    const wsManager = new WebSocketManager(`/ws/user/${userId}`, {
      onMessage: (message) => {
        console.log('[useUserChannel] Message:', message)
        setLastMessage(message)
      },
      onStateChange: (newState) => {
        console.log('[useUserChannel] Connection state:', newState)
        setConnectionState(newState)
      },
      autoReconnect: true,
    })

    wsManagerRef.current = wsManager
    wsManager.connect()

    return () => {
      wsManager.disconnect()
      wsManagerRef.current = null
    }
  }, [userId, enabled])

  const reconnect = useCallback(() => {
    wsManagerRef.current?.connect()
  }, [])

  const isConnected = connectionState !== 'disconnected'

  return {
    connectionState,
    isConnected,
    reconnect,
    lastMessage,
  }
}
