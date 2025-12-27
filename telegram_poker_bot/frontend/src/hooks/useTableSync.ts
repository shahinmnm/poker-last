/**
 * Phase 5: useTableSync Hook
 * 
 * Manages table state synchronization via WebSocket.
 * Provides normalized table state and connection status.
 * 
 * Features:
 * - Full state replacement on reconnect snapshots
 * - Delta merging for normal state_update messages
 * - Reconnect event handling with forced resync
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createTableWebSocket, WebSocketManager } from '../services/WebSocketManager'
import type {
  ConnectionState,
  NormalizedTableState,
  TableDeltaMessage,
} from '../types/normalized'

// Debug logging helper - only logs in development
const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true

function debugLog(category: string, message: string, data?: Record<string, unknown>): void {
  if (DEBUG) {
    if (data) {
      console.debug(`[useTableSync:${category}]`, message, data)
    } else {
      console.debug(`[useTableSync:${category}]`, message)
    }
  }
}

interface UseTableSyncOptions {
  tableId: number | string
  enabled?: boolean
  onSchemaVersionMismatch?: () => void
  onDelta?: (delta: TableDeltaMessage) => void
  onReconnect?: () => void
}

interface UseTableSyncReturn {
  state: NormalizedTableState | null
  connectionState: ConnectionState
  isConnected: boolean
  isLive: boolean
  isReconnecting: boolean
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
    if (Object.prototype.hasOwnProperty.call(source, key)) {
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
  const { tableId, enabled = true, onSchemaVersionMismatch, onDelta, onReconnect } = options

  const [state, setState] = useState<NormalizedTableState | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const wsManagerRef = useRef<WebSocketManager | null>(null)
  const onSchemaVersionMismatchRef = useRef(onSchemaVersionMismatch)
  const onDeltaRef = useRef(onDelta)
  const onReconnectRef = useRef(onReconnect)

  // Update refs when callbacks change
  useEffect(() => {
    onSchemaVersionMismatchRef.current = onSchemaVersionMismatch
  }, [onSchemaVersionMismatch])

  useEffect(() => {
    onDeltaRef.current = onDelta
  }, [onDelta])

  useEffect(() => {
    onReconnectRef.current = onReconnect
  }, [onReconnect])

  // Initialize WebSocket manager
  useEffect(() => {
    if (!enabled) return

    const wsManager = createTableWebSocket(tableId, {
      onSnapshot: (snapshot, isReconnectSnapshot) => {
        debugLog('snapshot', isReconnectSnapshot ? 'Reconnect snapshot received' : 'Initial snapshot received', {
          isReconnectSnapshot,
        })
        
        // On reconnect, completely replace state (server truth)
        // This ensures we don't have stale data from missed messages
        if (isReconnectSnapshot) {
          debugLog('snapshot', 'Applying full state replacement from reconnect snapshot')
          // Full replacement - server state is authoritative
          setState(snapshot)
        } else {
          // Normal snapshot - also full replacement
          setState(snapshot)
        }
        
        setLastUpdate(Date.now())
        setIsReconnecting(false)
      },
      onDelta: (delta) => {
        debugLog('delta', 'Delta received', { type: delta.type })
        
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
        debugLog('connection', 'Connection state changed', { newState })
        setConnectionState(newState)

        // Handle schema version mismatch
        if (newState === 'version_mismatch') {
          onSchemaVersionMismatchRef.current?.()
        }
        
        // Track reconnecting state
        if (newState === 'disconnected') {
          // Will be reconnecting if we had a previous connection
          setIsReconnecting(true)
        }
      },
      onReconnect: () => {
        debugLog('reconnect', 'Reconnect event triggered')
        setIsReconnecting(true)
        onReconnectRef.current?.()
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
    isReconnecting,
    reconnect,
    requestSnapshot,
    lastUpdate,
  }
}
