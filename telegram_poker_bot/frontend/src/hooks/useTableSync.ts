/**
 * Phase 5: useTableSync Hook
 * 
 * Manages table state synchronization via WebSocket.
 * Provides normalized table state and connection status.
 * 
 * Features:
 * - Full state replacement on reconnect snapshots
 * - Schema-aware delta merging for state_update messages
 * - Critical arrays (pots, seats, board, actions) replaced entirely - never merged by index
 * - Authoritative event detection for safe phase transitions
 * - State validation to detect impossible transitions
 * - Reconnect event handling with forced resync
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createTableWebSocket, WebSocketManager } from '../services/WebSocketManager'
import type {
  ConnectionState,
  NormalizedTableState,
  TableDeltaMessage,
  Seat,
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

// ============================================================================
// Schema-Aware Merge Policy
// ============================================================================

/**
 * Message types that indicate authoritative state transitions.
 * When these occur, the entire state should be replaced (not merged).
 */
const AUTHORITATIVE_EVENT_TYPES = [
  'hand_ended',
  'new_hand',
  'hand_started',
  'street_changed',
  'phase_changed',
  'showdown',
  'table_state',
  'state_snapshot',
  'full_state',
] as const

/**
 * Determines if a websocket message represents an authoritative event
 * that requires full state replacement instead of merge.
 */
function isAuthoritativeEvent(message: TableDeltaMessage): boolean {
  const messageType = (message.type || '').toLowerCase()
  
  // Check if message type indicates authoritative event
  if (AUTHORITATIVE_EVENT_TYPES.some(authType => 
    messageType === authType || messageType.includes(authType)
  )) {
    return true
  }
  
  // Check for full state payload markers
  const payload = message.payload as Record<string, unknown> | undefined
  if (payload) {
    // If payload contains both seat_map and pots, likely a full state
    if (Array.isArray(payload.seat_map) && Array.isArray(payload.pots)) {
      return true
    }
    // Check for explicit full_state flag
    if (payload.full_state === true || payload.is_authoritative === true) {
      return true
    }
  }
  
  return false
}

/**
 * Merges seat arrays by seat_index for stable seat identity.
 * Each seat in the patch replaces the corresponding seat in target by seat_index.
 */
function mergeSeatsByIndex(target: Seat[], patch: Seat[]): Seat[] {
  // Create a map of target seats by seat_index
  const targetMap = new Map<number, Seat>()
  for (const seat of target) {
    targetMap.set(seat.seat_index, seat)
  }
  
  // Apply patches by seat_index
  for (const patchSeat of patch) {
    targetMap.set(patchSeat.seat_index, patchSeat)
  }
  
  // Return array sorted by seat_index for consistent ordering
  return Array.from(targetMap.values()).sort((a, b) => a.seat_index - b.seat_index)
}

interface MergeOptions {
  /** If true, merge seat_map by seat_index instead of replacing */
  mergeSeatsByKey?: boolean
  /** Message type for logging */
  messageType?: string
}

/**
 * Schema-aware merge for NormalizedTableState.
 * 
 * Rules:
 * 1. Primitive fields: patch overwrites target when defined
 * 2. Nested objects: merge recursively (except arrays)
 * 3. Critical arrays: ALWAYS replace entirely (never merge by index)
 * 4. seat_map: Can optionally merge by seat_index if stable
 */
function mergeTableState(
  target: NormalizedTableState,
  patch: Partial<NormalizedTableState>,
  options: MergeOptions = {}
): NormalizedTableState {
  const result = { ...target }
  const replacedArrays: string[] = []
  
  for (const key in patch) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue
    
    const patchValue = patch[key as keyof NormalizedTableState]
    const targetValue = target[key as keyof NormalizedTableState]
    
    // Handle null/undefined explicitly
    if (patchValue === null || patchValue === undefined) {
      (result as Record<string, unknown>)[key] = patchValue
      continue
    }
    
    // Handle arrays - critical arrays are always replaced
    if (Array.isArray(patchValue)) {
      // Special handling for seat_map with stable seat_index
      if (key === 'seat_map' && options.mergeSeatsByKey && Array.isArray(targetValue)) {
        (result as Record<string, unknown>)[key] = mergeSeatsByIndex(
          targetValue as Seat[],
          patchValue as Seat[]
        )
        replacedArrays.push(`${key}(merged by seat_index)`)
      } else {
        // Replace entire array for all critical arrays
        (result as Record<string, unknown>)[key] = patchValue
        replacedArrays.push(`${key}(${(patchValue as unknown[]).length} items)`)
      }
      continue
    }
    
    // Handle nested objects - deep merge
    if (
      typeof patchValue === 'object' &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key] = {
        ...targetValue,
        ...patchValue,
      }
      continue
    }
    
    // Primitive values - replace
    (result as Record<string, unknown>)[key] = patchValue
  }
  
  // Debug log replaced arrays
  if (DEBUG && replacedArrays.length > 0) {
    debugLog('merge', 'Arrays replaced', {
      messageType: options.messageType,
      arrays: replacedArrays,
    })
  }
  
  return result
}

/**
 * Validates state transition to detect impossible/unsafe changes.
 * Returns true if state appears inconsistent and a snapshot refresh is needed.
 */
function shouldForceSnapshot(
  prev: NormalizedTableState,
  next: NormalizedTableState,
  message: TableDeltaMessage
): { shouldRefresh: boolean; reason?: string } {
  // Check for negative chip totals in pots
  if (next.pots) {
    for (const pot of next.pots) {
      if (pot.amount < 0) {
        return {
          shouldRefresh: true,
          reason: `Negative pot amount detected: pot_index=${pot.pot_index}, amount=${pot.amount}`,
        }
      }
    }
  }
  
  // Check for negative stack amounts in seats
  if (next.seat_map) {
    for (const seat of next.seat_map) {
      if (seat.stack_amount < 0) {
        return {
          shouldRefresh: true,
          reason: `Negative stack detected: seat_index=${seat.seat_index}, stack=${seat.stack_amount}`,
        }
      }
    }
  }
  
  // Check for board regression (cards decreasing without hand reset)
  if (
    prev.community_cards &&
    next.community_cards &&
    next.community_cards.length < prev.community_cards.length
  ) {
    // Only flag as issue if not a hand transition event
    if (!isAuthoritativeEvent(message)) {
      return {
        shouldRefresh: true,
        reason: `Board cards decreased without hand reset: ${prev.community_cards.length} -> ${next.community_cards.length}`,
      }
    }
  }
  
  // Check for acting_seat_id set but no legal_actions (possible desync)
  if (
    next.acting_seat_id !== null &&
    (!next.legal_actions || next.legal_actions.length === 0)
  ) {
    // This might be a partial update, log warning but don't force refresh yet
    if (DEBUG) {
      debugLog('validation', 'Acting seat set but no legal actions', {
        acting_seat_id: next.acting_seat_id,
      })
    }
  }
  
  return { shouldRefresh: false }
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
        
        // Check if this is an authoritative event (requires full state replacement)
        if (isAuthoritativeEvent(delta)) {
          debugLog('authoritative', 'Authoritative event detected - full state replacement', {
            type: delta.type,
            tableVersion: delta.table_version,
            eventSeq: delta.event_seq,
          })
          
          // For authoritative events, replace state entirely if payload is complete
          const payload = delta.payload as NormalizedTableState
          if (payload && payload.seat_map && payload.pots) {
            setState(payload)
            setLastUpdate(Date.now())
            onDeltaRef.current?.(delta)
            return
          }
          // If payload is not complete, request a snapshot
          debugLog('authoritative', 'Authoritative event with partial payload - requesting snapshot')
          wsManagerRef.current?.requestSnapshot()
          return
        }
        
        // Schema-aware delta merge
        setState((prev) => {
          if (!prev) return prev
          
          // Apply schema-aware merge with array replacement policy
          const merged = mergeTableState(prev, delta.payload as Partial<NormalizedTableState>, {
            messageType: delta.type,
          })
          
          // Validate the merged state for impossible transitions
          const validation = shouldForceSnapshot(prev, merged, delta)
          if (validation.shouldRefresh) {
            debugLog('validation', 'Invalid state detected - requesting snapshot', {
              reason: validation.reason,
            })
            // Request snapshot but still apply merged state temporarily
            // The snapshot will override when it arrives
            wsManagerRef.current?.requestSnapshot()
          }
          
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
