import { useEffect, useRef, useCallback, useState } from 'react'
import { resolveWebSocketUrl } from '../utils/apiClient'

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseTableWebSocketOptions {
  tableId: string | number
  onMessage?: (data: any) => void
  onStateChange?: (payload: any) => void
  onConnect?: () => void
  onDisconnect?: () => void
  enabled?: boolean
}

interface UseTableWebSocketReturn {
  status: WebSocketStatus
  sendMessage: (data: any) => void
  reconnect: () => void
}

/**
 * Custom hook for managing stable WebSocket connection to a poker table.
 * 
 * Features:
 * - Single persistent connection (no recreation on re-renders)
 * - Automatic reconnection with exponential backoff
 * - Ping/pong heartbeat handling
 * - Proper cleanup on unmount
 * - Connection status tracking
 */
export function useTableWebSocket(options: UseTableWebSocketOptions): UseTableWebSocketReturn {
  const {
    tableId,
    onMessage,
    onStateChange,
    onConnect,
    onDisconnect,
    enabled = true,
  } = options

  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const pingIntervalRef = useRef<number | null>(null)
  const isManualCloseRef = useRef(false)

  // Stable callbacks using refs to avoid recreating socket
  const onMessageRef = useRef(onMessage)
  const onStateChangeRef = useRef(onStateChange)
  const onConnectRef = useRef(onConnect)
  const onDisconnectRef = useRef(onDisconnect)

  useEffect(() => {
    onMessageRef.current = onMessage
    onStateChangeRef.current = onStateChange
    onConnectRef.current = onConnect
    onDisconnectRef.current = onDisconnect
  }, [onMessage, onStateChange, onConnect, onDisconnect])

  const cleanup = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    // Close socket
    if (socketRef.current) {
      isManualCloseRef.current = true
      socketRef.current.close()
      socketRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!enabled) {
      return
    }

    // Don't create multiple connections
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return
    }

    // Close existing socket if any
    if (socketRef.current) {
      socketRef.current.close()
    }

    try {
      const wsUrl = resolveWebSocketUrl(`/ws/${tableId}`)
      const socket = new WebSocket(wsUrl)
      socketRef.current = socket
      isManualCloseRef.current = false
      setStatus('connecting')

      socket.onopen = () => {
        setStatus('connected')
        reconnectAttemptsRef.current = 0
        onConnectRef.current?.()

        // Start ping interval to keep connection alive
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
        }
        pingIntervalRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'pong' }))
          }
        }, 25000) // Send pong every 25 seconds (server pings every 30)
      }

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          
          // Handle ping from server
          if (payload?.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }))
            return
          }

          // Handle acknowledgments
          if (payload?.type === 'ack' || payload?.type === 'pong') {
            return
          }

          // Call generic message handler
          onMessageRef.current?.(payload)

          // Call specific state change handler
          if (payload?.type === 'table_state') {
            onStateChangeRef.current?.(payload)
          }
        } catch (error) {
          // Failed to parse message - ignore
        }
      }

      socket.onerror = () => {
        setStatus('error')
      }

      socket.onclose = () => {
        setStatus('disconnected')
        onDisconnectRef.current?.()

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Attempt reconnection if not manually closed
        if (!isManualCloseRef.current && enabled) {
          const attempt = reconnectAttemptsRef.current
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000) // Max 30 seconds
          reconnectAttemptsRef.current += 1

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }
    } catch (error) {
      setStatus('error')
    }
  }, [tableId, enabled])

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data))
    }
    // Silently ignore if not connected
  }, [])

  const reconnect = useCallback(() => {
    cleanup()
    reconnectAttemptsRef.current = 0
    connect()
  }, [cleanup, connect])

  // Connect on mount, disconnect on unmount
  // Note: connect and cleanup are stable (memoized with useCallback) and have the
  // same dependencies as this effect, so they don't need to be in the deps array.
  // However, we include them to satisfy React's exhaustive-deps rule.
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, enabled]) // Only reconnect when tableId or enabled changes

  return {
    status,
    sendMessage,
    reconnect,
  }
}
