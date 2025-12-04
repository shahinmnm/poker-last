/**
 * Phase 5: useLobbySync Hook
 * 
 * Manages lobby state synchronization via WebSocket.
 * Provides incremental lobby updates.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createLobbyWebSocket, WebSocketManager } from '../services/WebSocketManager'
import type {
  ConnectionState,
  LobbyEntry,
  LobbyDeltaMessage,
} from '../types/normalized'

interface UseLobbySyncOptions {
  enabled?: boolean
  refreshInterval?: number // ms for periodic REST refresh
}

interface UseLobbySyncReturn {
  tables: LobbyEntry[]
  connectionState: ConnectionState
  isConnected: boolean
  reconnect: () => void
  refresh: () => void
}

export function useLobbySync(options: UseLobbySyncOptions = {}): UseLobbySyncReturn {
  const { enabled = true, refreshInterval = 25000 } = options

  const [tables, setTables] = useState<LobbyEntry[]>([])
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  const wsManagerRef = useRef<WebSocketManager | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch tables from REST API
  const fetchTables = useCallback(async () => {
    try {
      const response = await fetch('/api/tables?scope=public')
      if (!response.ok) {
        throw new Error('Failed to fetch tables')
      }
      const data = await response.json()
      
      // Transform to LobbyEntry format
      const lobbyTables: LobbyEntry[] = (data.tables || []).map((t: any) => ({
        table_id: t.table_id,
        template_name: t.template?.name || t.table_name || 'Unknown',
        variant: t.game_variant || 'holdem',
        stakes: t.template?.config?.stakes || 'Unknown',
        player_count: t.player_count || 0,
        max_players: t.max_players || 9,
        waitlist_count: t.waitlist_count || 0,
        uptime: t.uptime,
        expiration: t.expires_at ? new Date(t.expires_at).getTime() : null,
        table_type: t.table_type || 'public',
        invite_only: t.is_private || false,
      }))
      
      setTables(lobbyTables)
    } catch (error) {
      console.error('[useLobbySync] Failed to fetch tables:', error)
    }
  }, [])

  // Initialize WebSocket manager
  useEffect(() => {
    if (!enabled) return

    // Initial fetch
    fetchTables()

    // Setup periodic refresh
    refreshTimerRef.current = setInterval(fetchTables, refreshInterval)

    const wsManager = createLobbyWebSocket({
      onMessage: (message) => {
        const lobbyMessage = message as LobbyDeltaMessage

        if (lobbyMessage.type === 'lobby_update') {
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
        }
      },
      onStateChange: (newState) => {
        console.log('[useLobbySync] Connection state:', newState)
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
  }, [enabled, refreshInterval, fetchTables])

  const reconnect = useCallback(() => {
    wsManagerRef.current?.connect()
  }, [])

  const refresh = useCallback(() => {
    fetchTables()
  }, [fetchTables])

  const isConnected = connectionState !== 'disconnected'

  return {
    tables,
    connectionState,
    isConnected,
    reconnect,
    refresh,
  }
}
