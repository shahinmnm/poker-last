/**
 * Phase 5: useTableSync Hook
 * 
 * Manages table state synchronization via WebSocket.
 * Provides normalized table state and connection status.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createTableWebSocket, WebSocketManager } from '../services/WebSocketManager'
import type {
  ConnectionState,
  NormalizedTableState,
  TableDeltaMessage,
} from '../types/normalized'

interface UseTableSyncOptions {
  tableId: number | string
  enabled?: boolean
  onSchemaVersionMismatch?: () => void
}

interface UseTableSyncReturn {
  state: NormalizedTableState | null
  connectionState: ConnectionState
  isConnected: boolean
  isLive: boolean
  reconnect: () => void
  requestSnapshot: () => void
  lastUpdate: number | null
}

export function useTableSync(options: UseTableSyncOptions): UseTableSyncReturn {
  const { tableId, enabled = true, onSchemaVersionMismatch } = options

  const [state, setState] = useState<NormalizedTableState | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  const wsManagerRef = useRef<WebSocketManager | null>(null)
  const onSchemaVersionMismatchRef = useRef(onSchemaVersionMismatch)

  // Update ref when callback changes
  useEffect(() => {
    onSchemaVersionMismatchRef.current = onSchemaVersionMismatch
  }, [onSchemaVersionMismatch])

  // Initialize WebSocket manager
  useEffect(() => {
    if (!enabled) return

    const wsManager = createTableWebSocket(tableId, {
      onSnapshot: (snapshot) => {
        console.log('[useTableSync] Snapshot received')
        setState(snapshot)
        setLastUpdate(Date.now())
      },
      onDelta: (delta) => {
        console.log('[useTableSync] Delta received:', delta.type)
        setState((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            ...delta.payload,
          }
        })
        setLastUpdate(Date.now())
      },
      onStateChange: (newState) => {
        console.log('[useTableSync] Connection state:', newState)
        setConnectionState(newState)

        // Handle schema version mismatch
        if (newState === 'version_mismatch') {
          onSchemaVersionMismatchRef.current?.()
        }
      },
      autoReconnect: true,
    })

    wsManagerRef.current = wsManager
    wsManager.connect()

    return () => {
      wsManager.disconnect()
      wsManagerRef.current = null
    }
  }, [tableId, enabled])

  const reconnect = useCallback(() => {
    wsManagerRef.current?.connect()
  }, [])

  const requestSnapshot = useCallback(() => {
    wsManagerRef.current?.requestSnapshot()
  }, [])

  const isConnected = connectionState !== 'disconnected'
  const isLive = connectionState === 'live'

  return {
    state,
    connectionState,
    isConnected,
    isLive,
    reconnect,
    requestSnapshot,
    lastUpdate,
  }
}
