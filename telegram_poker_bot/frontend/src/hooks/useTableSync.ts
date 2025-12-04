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
  onDelta?: (delta: TableDeltaMessage) => void
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

/**
 * Deep merge utility for nested objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target }

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (sourceValue === null || sourceValue === undefined) {
        // Explicitly set null/undefined values
        result[key] = sourceValue as T[Extract<keyof T, string>]
      } else if (Array.isArray(sourceValue)) {
        // Replace arrays completely (no partial array merge)
        result[key] = sourceValue as T[Extract<keyof T, string>]
      } else if (typeof sourceValue === 'object' && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        // Deep merge objects
        result[key] = deepMerge(targetValue, sourceValue) as T[Extract<keyof T, string>]
      } else {
        // Replace primitive values
        result[key] = sourceValue as T[Extract<keyof T, string>]
      }
    }
  }

  return result
}

export function useTableSync(options: UseTableSyncOptions): UseTableSyncReturn {
  const { tableId, enabled = true, onSchemaVersionMismatch, onDelta } = options

  const [state, setState] = useState<NormalizedTableState | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)

  const wsManagerRef = useRef<WebSocketManager | null>(null)
  const onSchemaVersionMismatchRef = useRef(onSchemaVersionMismatch)
  const onDeltaRef = useRef(onDelta)

  // Update refs when callbacks change
  useEffect(() => {
    onSchemaVersionMismatchRef.current = onSchemaVersionMismatch
  }, [onSchemaVersionMismatch])

  useEffect(() => {
    onDeltaRef.current = onDelta
  }, [onDelta])

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
          
          // Deep merge delta payload with previous state
          // This handles nested objects like seat_map, pots, table_metadata, etc.
          const merged = deepMerge(prev, delta.payload as Partial<NormalizedTableState>)
          
          return merged
        })
        setLastUpdate(Date.now())
        
        // Call user's onDelta callback
        onDeltaRef.current?.(delta)
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
