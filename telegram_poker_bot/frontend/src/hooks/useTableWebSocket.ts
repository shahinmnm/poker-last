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
  /** Wait for WebSocket to be connected. Returns true if connected, false if timeout. */
  waitForConnection: (timeoutMs?: number) => Promise<boolean>
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
        console.log('[WebSocket] Connected to table', tableId)
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
          console.warn('[WebSocket] Failed to parse message:', error)
        }
      }

      socket.onerror = (error) => {
        console.error('[WebSocket] Error:', error)
        setStatus('error')
      }

      socket.onclose = (event) => {
        console.log('[WebSocket] Disconnected from table', tableId, 'code:', event.code)
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

          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${attempt + 1})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        }
      }
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error)
      setStatus('error')
    }
  }, [tableId, enabled])

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data))
    } else {
      console.warn('[WebSocket] Cannot send message: socket not connected')
    }
  }, [])

  const reconnect = useCallback(() => {
    cleanup()
    reconnectAttemptsRef.current = 0
    connect()
  }, [cleanup, connect])

  /**
   * Wait for WebSocket to be connected.
   * This is crucial for ensuring WebSocket is ready BEFORE performing actions
   * that trigger broadcasts (like sitting at table).
   * 
   * @param timeoutMs Maximum time to wait (default 5000ms)
   * @returns Promise that resolves to true if connected, false if timeout
   */
  const waitForConnection = useCallback(async (timeoutMs = 5000): Promise<boolean> => {
    const startTime = Date.now()
    
    // If already connected, return immediately
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected, no wait needed')
      return true
    }
    
    // Poll for connection status
    return new Promise((resolve) => {
      const checkConnection = () => {
        // Check if connected
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          console.log('[WebSocket] Connection established after waiting')
          resolve(true)
          return
        }
        
        // Check timeout
        if (Date.now() - startTime >= timeoutMs) {
          console.warn('[WebSocket] Connection timeout after', timeoutMs, 'ms')
          resolve(false)
          return
        }
        
        // Continue polling
        setTimeout(checkConnection, 100)
      }
      
      checkConnection()
    })
  }, [])

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
    waitForConnection,
  }
}
