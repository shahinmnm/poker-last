/**
 * Phase 5: useLobbySync Hook
 * 
 * Manages lobby state synchronization via WebSocket.
 * Provides incremental lobby updates.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createLobbyWebSocket, WebSocketManager } from '../services/WebSocketManager'
import { apiFetch } from '../utils/apiClient'
import type {
  ConnectionState,
  LobbyEntry,
  LobbyDeltaMessage,
  TableType,
} from '../types/normalized'

interface UseLobbySyncOptions {
  enabled?: boolean
  refreshInterval?: number // ms for periodic REST refresh
  initData?: string | null
  query?: Record<string, string | number | boolean | null | undefined>
}

interface UseLobbySyncReturn {
  tables: LobbyEntry[]
  connectionState: ConnectionState
  isConnected: boolean
  reconnect: () => void
  refresh: () => Promise<void>
  loading: boolean
  refreshing: boolean
  error: string | null
}

// Raw table data shape from backend
interface RawTableData {
  table_id: number
  template?: {
    name?: string
    config?: Record<string, any>
    config_json?: {
      backend?: Record<string, any>
    }
    table_type?: string
  }
  table_name?: string
  game_variant?: string
  player_count?: number
  max_players?: number
  waitlist_count?: number
  uptime?: number
  expires_at?: string
  is_private?: boolean
  table_type?: string
  currency?: string
  currency_type?: string
  buy_in_min?: number
  buy_in_max?: number
  rake?: number
  turn_timer?: number
  betting_structure?: string
}

// Helper to normalize table_type string to TableType
function normalizeTableType(tableType: string | undefined): TableType {
  if (!tableType) return 'public'
  const normalized = tableType.toLowerCase()
  if (normalized === 'public' || normalized === 'private' || normalized === 'persistent' || normalized === 'sng') {
    return normalized as TableType
  }
  return 'public'
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

// Helper to convert raw table data to LobbyEntry
function convertToLobbyEntry(t: RawTableData): LobbyEntry {
  const templateConfig =
    t.template?.config ||
    t.template?.config_json?.backend ||
    {}
  const rawStakes =
    typeof templateConfig?.stakes === 'string' ? templateConfig.stakes : undefined
  const smallBlind = toNumber(templateConfig?.small_blind)
  const bigBlind = toNumber(templateConfig?.big_blind)
  const resolvedStakes =
    rawStakes ||
    (smallBlind !== undefined && bigBlind !== undefined
      ? `${smallBlind}/${bigBlind}`
      : 'Unknown')

  return {
    table_id: t.table_id,
    template_name: t.template?.name || t.table_name || 'Unknown',
    variant: t.game_variant || 'holdem',
    stakes: resolvedStakes,
    player_count: t.player_count || 0,
    max_players: t.max_players || 9,
    waitlist_count: t.waitlist_count || 0,
    uptime: t.uptime,
    expiration: t.expires_at ? new Date(t.expires_at).getTime() : null,
    table_type: normalizeTableType(t.template?.table_type || t.table_type),
    invite_only: t.is_private || false,
    currency:
      t.currency ||
      t.currency_type ||
      (templateConfig?.currency as string | undefined),
    buy_in_min: toNumber(t.buy_in_min ?? templateConfig?.buy_in_min),
    buy_in_max: toNumber(t.buy_in_max ?? templateConfig?.buy_in_max),
    rake: t.rake,
    turn_timer: t.turn_timer,
    betting_structure: t.betting_structure as LobbyEntry['betting_structure'],
  }
}

export function useLobbySync(options: UseLobbySyncOptions = {}): UseLobbySyncReturn {
  const { enabled = true, refreshInterval = 25000, initData, query } = options

  const resolvedQuery = useMemo(() => query ?? { lobby_persistent: true }, [query])
  const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true

  const [tables, setTables] = useState<LobbyEntry[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [loading, setLoading] = useState(enabled)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsManagerRef = useRef<WebSocketManager | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  // Create a stable fetch function using useCallback
  const fetchTables = useCallback(async (mode: 'initial' | 'manual' | 'interval') => {
    if (!enabled) {
      return
    }
    if (mode === 'initial') {
      setLoading(true)
    }
    if (mode === 'manual') {
      setRefreshing(true)
    }
    try {
      const data = await apiFetch<unknown>('/tables', { initData, query: resolvedQuery })
      const tablesData: RawTableData[] = Array.isArray(data)
        ? (data as RawTableData[])
        : (data && typeof data === 'object' && 'tables' in (data as Record<string, unknown>)
            ? ((data as { tables?: RawTableData[] }).tables || [])
            : [])
      
      // Transform to LobbyEntry format using helper
      const lobbyTables: LobbyEntry[] = tablesData.map((t: RawTableData) => convertToLobbyEntry(t))
      
      setTables(lobbyTables)
      setError(null)
    } catch (error) {
      if (DEBUG) {
        console.error('[useLobbySync] Failed to fetch tables:', error)
      }
      setError(error instanceof Error ? error.message : 'Failed to fetch tables')
    } finally {
      if (mode === 'initial') {
        setLoading(false)
      }
      if (mode === 'manual') {
        setRefreshing(false)
      }
    }
  }, [DEBUG, enabled, initData, resolvedQuery]) // Empty deps - function is stable across renders

  // Initialize WebSocket manager
  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchTables('initial')

    // Setup periodic refresh
    refreshTimerRef.current = setInterval(() => {
      fetchTables('interval')
    }, refreshInterval)

    const wsManager = createLobbyWebSocket({
      onMessage: (message) => {
        const lobbyMessage = message as unknown as LobbyDeltaMessage

        if (lobbyMessage.type === 'lobby_snapshot') {
          // Initial snapshot from server - replace entire table list
          const snapshotTables = (lobbyMessage.tables || []) as RawTableData[]
          const lobbyEntries: LobbyEntry[] = snapshotTables.map(convertToLobbyEntry)
          
          setTables(lobbyEntries)
          setLoading(false)
          setError(null)
          if (DEBUG) {
            console.log('[useLobbySync] Received lobby snapshot', { tableCount: lobbyEntries.length })
          }
        } else if (lobbyMessage.type === 'lobby_update') {
          const entry = lobbyMessage.payload as LobbyEntry
          setTables((prev) => {
            const index = prev.findIndex((t) => t.table_id === entry.table_id)
            if (index >= 0) {
              // Update existing
              const updated = [...prev]
              updated[index] = entry
              return updated
            } else {
              // Add new
              return [...prev, entry]
            }
          })
        } else if (lobbyMessage.type === 'table_added') {
          const entry = lobbyMessage.payload as LobbyEntry
          setTables((prev) => [...prev, entry])
        } else if (lobbyMessage.type === 'table_removed') {
          const { table_id } = lobbyMessage.payload as { table_id: number }
          setTables((prev) => prev.filter((t) => t.table_id !== table_id))
        } else if (lobbyMessage.type === 'TABLE_REMOVED') {
          // Backend sends uppercase event type
          const table_id = (lobbyMessage as { table_id?: number }).table_id
          if (table_id) {
            setTables((prev) => prev.filter((t) => t.table_id !== table_id))
          }
        } else if (lobbyMessage.type === 'TABLE_UPDATED') {
          // Backend sends uppercase event type with table payload
          const tablePayload = (lobbyMessage as { table?: unknown }).table
          if (tablePayload) {
            const entry = convertToLobbyEntry(tablePayload as RawTableData)
            setTables((prev) => {
              const index = prev.findIndex((t) => t.table_id === entry.table_id)
              if (index >= 0) {
                const updated = [...prev]
                updated[index] = entry
                return updated
              } else {
                return [...prev, entry]
              }
            })
          }
        }
      },
      onStateChange: (newState) => {
        if (DEBUG) {
          console.log('[useLobbySync] Connection state:', newState)
        }
        setConnectionState(newState)
      },
      autoReconnect: true,
    })

    wsManagerRef.current = wsManager
    wsManager.connect()

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
      wsManager.disconnect()
      wsManagerRef.current = null
    }
  }, [enabled, fetchTables, refreshInterval])

  const reconnect = useCallback(() => {
    wsManagerRef.current?.connect()
  }, [])

  const refresh = useCallback(async () => {
    await fetchTables('manual')
  }, [fetchTables])

  const isConnected = connectionState !== 'disconnected'

  return {
    tables,
    connectionState,
    isConnected,
    reconnect,
    refresh,
    loading,
    refreshing,
    error,
  }
}
