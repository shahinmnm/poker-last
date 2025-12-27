/**
 * Phase 5: WebSocket Manager
 * 
 * Manages WebSocket connections with:
 * - Heartbeat (ping/pong)
 * - Automatic reconnection with exponential backoff
 * - Snapshot syncing on connect
 * - Delta merging with sequence tracking
 * - Out-of-order message buffering and reordering
 * - Schema version mismatch detection
 * - Robust reconnect state machine with snapshot refresh
 */

import { resolveWebSocketUrl, apiFetch } from '../utils/apiClient'
import type {
  ConnectionState,
  TableDeltaMessage,
  NormalizedTableState,
  WebSocketMessage,
} from '../types/normalized'

// Debug logging helper - only logs in development
const DEBUG = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true

function debugLog(category: string, message: string, data?: Record<string, unknown>): void {
  if (DEBUG) {
    if (data) {
      console.debug(`[WS:${category}]`, message, data)
    } else {
      console.debug(`[WS:${category}]`, message)
    }
  }
}

type MessageHandler = (message: WebSocketMessage) => void
type StateChangeHandler = (state: ConnectionState) => void
type SnapshotHandler = (snapshot: NormalizedTableState, isReconnectSnapshot: boolean) => void
type DeltaHandler = (delta: TableDeltaMessage) => void
type ReconnectHandler = () => void

interface WebSocketManagerOptions {
  onMessage?: MessageHandler
  onStateChange?: StateChangeHandler
  onSnapshot?: SnapshotHandler
  onDelta?: DeltaHandler
  onReconnect?: ReconnectHandler
  autoReconnect?: boolean
  heartbeatInterval?: number // ms
  reconnectDelay?: number // ms (initial)
  maxReconnectDelay?: number // ms
  gapTimeoutMs?: number // ms (default: 500)
  snapshotDebounceMs?: number // ms (default: 1000)
}

export class WebSocketManager {
  private socket: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = 0
  private lastSnapshot: NormalizedTableState | null = null
  private expectedSeq: number | null = null
  private expectedTableVersion: number | null = null
  private expectedSchemaVersion: string | null = null
  private messageBuffer: Map<number, TableDeltaMessage> = new Map()
  private gapTimeout: ReturnType<typeof setTimeout> | null = null

  // Reconnect state machine
  private hasConnectedBefore = false
  private isReconnecting = false
  private snapshotRefreshDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private lastSnapshotRefreshTime = 0
  private tableId: string | number | null = null

  private readonly url: string
  private readonly options: Required<WebSocketManagerOptions>

  constructor(url: string, options: WebSocketManagerOptions = {}) {
    this.url = url
    // Extract tableId from URL pattern /ws/{tableId}
    const tableIdMatch = url.match(/\/ws\/(\d+|[a-zA-Z0-9_-]+)/)
    this.tableId = tableIdMatch ? tableIdMatch[1] : null
    
    this.options = {
      onMessage: options.onMessage || (() => {}),
      onStateChange: options.onStateChange || (() => {}),
      onSnapshot: options.onSnapshot || (() => {}),
      onDelta: options.onDelta || (() => {}),
      onReconnect: options.onReconnect || (() => {}),
      autoReconnect: options.autoReconnect ?? true,
      heartbeatInterval: options.heartbeatInterval || 25000, // 25s
      reconnectDelay: options.reconnectDelay || 1000, // 1s
      maxReconnectDelay: options.maxReconnectDelay || 30000, // 30s
      gapTimeoutMs: options.gapTimeoutMs || 500, // 500ms
      snapshotDebounceMs: options.snapshotDebounceMs || 1000, // 1s debounce
    }
  }

  /**
   * Connect to WebSocket
   */
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      console.warn('[WS] Already connected')
      return
    }

    this.updateState('connecting')
    this.clearReconnectTimer()

    try {
      const wsUrl = resolveWebSocketUrl(this.url)
      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => this.handleOpen()
      this.socket.onmessage = (event) => this.handleMessage(event)
      this.socket.onerror = (error) => this.handleError(error)
      this.socket.onclose = (event) => this.handleClose(event)
    } catch (error) {
      console.error('[WS] Connection error:', error)
      this.scheduleReconnect()
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.options.autoReconnect = false
    this.clearTimers()

    // Clear buffer and timeout
    this.messageBuffer.clear()
    if (this.gapTimeout) {
      clearTimeout(this.gapTimeout)
      this.gapTimeout = null
    }

    if (this.socket) {
      this.socket.close(1000, 'Client disconnect')
      this.socket = null
    }

    this.updateState('disconnected')
  }

  /**
   * Send message
   */
  send(message: WebSocketMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    } else {
      console.warn('[WS] Cannot send message, not connected')
    }
  }

  /**
   * Get current state
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Get last snapshot
   */
  getLastSnapshot(): NormalizedTableState | null {
    return this.lastSnapshot
  }

  /**
   * Request full snapshot (for resync)
   */
  requestSnapshot(): void {
    this.send({ type: 'request_snapshot' })
    this.updateState('syncing_snapshot')
  }

  /**
   * Check if this is a reconnection (not first connection)
   */
  isReconnect(): boolean {
    return this.isReconnecting
  }

  /**
   * Get current reconnect attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleOpen(): void {
    const isReconnect = this.hasConnectedBefore
    this.isReconnecting = isReconnect
    
    debugLog('connect', isReconnect ? 'Reconnected' : 'Connected (first time)', {
      reconnectAttempts: this.reconnectAttempts,
      tableId: this.tableId,
    })
    
    console.log('[WS] Connected', isReconnect ? '(reconnect)' : '(first)')
    
    // Mark that we've connected at least once
    this.hasConnectedBefore = true
    this.reconnectAttempts = 0
    
    // Start heartbeat
    this.startHeartbeat()
    
    // On reconnect, always force a snapshot refresh
    if (isReconnect) {
      debugLog('reconnect', 'Triggering snapshot refresh on reconnect')
      this.options.onReconnect()
      this.triggerSnapshotRefresh()
    } else if (this.lastSnapshot) {
      // We have cached state, request snapshot to verify
      this.requestSnapshot()
    } else {
      // First connection, expect snapshot from server
      this.updateState('syncing_snapshot')
    }
  }

  /**
   * Trigger a snapshot refresh with debouncing to avoid hammering
   * Uses both WS request and REST fallback
   */
  private triggerSnapshotRefresh(): void {
    const now = Date.now()
    const timeSinceLastRefresh = now - this.lastSnapshotRefreshTime
    
    // Debounce: if we just refreshed, skip
    if (timeSinceLastRefresh < this.options.snapshotDebounceMs) {
      debugLog('snapshot', 'Snapshot refresh debounced', {
        timeSinceLastRefresh,
        debounceMs: this.options.snapshotDebounceMs,
      })
      return
    }
    
    // Clear any pending debounce timer
    if (this.snapshotRefreshDebounceTimer) {
      clearTimeout(this.snapshotRefreshDebounceTimer)
      this.snapshotRefreshDebounceTimer = null
    }
    
    this.lastSnapshotRefreshTime = now
    debugLog('snapshot', 'Snapshot refresh triggered')
    
    // Strategy: Try WS first, then fallback to REST
    // Send WS snapshot request
    this.send({ type: 'get_snapshot' })
    this.updateState('syncing_snapshot')
    
    // Fallback: Also fetch via REST API as a safety net
    // This ensures we get state even if WS doesn't support get_snapshot
    this.fetchSnapshotViaRest()
  }

  /**
   * Fetch snapshot via REST API (fallback mechanism)
   */
  private async fetchSnapshotViaRest(): Promise<void> {
    if (!this.tableId) {
      debugLog('snapshot', 'Cannot fetch REST snapshot - no tableId')
      return
    }
    
    try {
      debugLog('snapshot', 'Fetching snapshot via REST', { tableId: this.tableId })
      
      const snapshot = await apiFetch<NormalizedTableState>(
        `/tables/${this.tableId}/state`
      )
      
      debugLog('snapshot', 'REST snapshot received', {
        tableId: this.tableId,
      })
      
      // Only apply if we're still in syncing state (WS didn't already provide snapshot)
      if (this.state === 'syncing_snapshot') {
        this.applyRestSnapshot(snapshot)
      } else {
        debugLog('snapshot', 'REST snapshot ignored - already synced via WS')
      }
    } catch (error) {
      debugLog('snapshot', 'REST snapshot fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      console.warn('[WS] Failed to fetch snapshot via REST:', error)
      // Don't fail hard - WS might still provide the snapshot
    }
  }

  /**
   * Apply a snapshot received via REST API
   */
  private applyRestSnapshot(snapshot: NormalizedTableState): void {
    // Clear buffer and timeout on snapshot
    this.messageBuffer.clear()
    if (this.gapTimeout) {
      clearTimeout(this.gapTimeout)
      this.gapTimeout = null
    }
    
    // Store snapshot
    this.lastSnapshot = snapshot
    // Reset sequence tracking - REST snapshot doesn't have event_seq
    this.expectedSeq = null
    this.expectedTableVersion = null
    
    // Notify handlers - mark as reconnect snapshot
    this.options.onSnapshot(snapshot, this.isReconnecting)
    this.updateState('live')
    
    debugLog('snapshot', 'REST snapshot applied', {
      isReconnect: this.isReconnecting,
    })
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage

      // Handle heartbeat
      if (message.type === 'ping') {
        this.send({ type: 'pong' })
        return
      }

      if (message.type === 'pong') {
        // Heartbeat acknowledged
        return
      }

      // Call generic message handler
      this.options.onMessage(message)

      // Handle specific message types
      if (message.type === 'snapshot' || message.type === 'lobby_snapshot') {
        this.handleSnapshot(message as unknown as TableDeltaMessage)
      } else if (this.isDeltaMessage(message)) {
        this.handleDelta(message as unknown as TableDeltaMessage)
      }
    } catch (error) {
      console.error('[WS] Failed to parse message:', error)
    }
  }

  private handleSnapshot(message: TableDeltaMessage): void {
    const snapshot = message.payload as NormalizedTableState

    // Check schema version (only for table snapshots, not lobby snapshots)
    if (
      message.type === 'snapshot' &&
      this.expectedSchemaVersion &&
      message.schema_version !== this.expectedSchemaVersion
    ) {
      console.error('[WS] Schema version mismatch!', {
        expected: this.expectedSchemaVersion,
        received: message.schema_version,
      })
      this.updateState('version_mismatch')
      // Trigger hard reload (handled by component)
      return
    }

    // Clear buffer and timeout on snapshot
    this.messageBuffer.clear()
    if (this.gapTimeout) {
      clearTimeout(this.gapTimeout)
      this.gapTimeout = null
    }

    // Store snapshot
    this.lastSnapshot = snapshot
    this.expectedSeq = message.event_seq
    this.expectedTableVersion = message.table_version
    this.expectedSchemaVersion = message.schema_version

    // Notify handlers - include reconnect flag
    this.options.onSnapshot(snapshot, this.isReconnecting)
    this.updateState('live')

    debugLog('snapshot', 'WS snapshot received', {
      type: message.type,
      table_version: message.table_version,
      event_seq: message.event_seq,
      isReconnect: this.isReconnecting,
    })

    console.log('[WS] Snapshot received', {
      type: message.type,
      table_version: message.table_version,
      event_seq: message.event_seq,
    })
    
    // Clear reconnecting flag after successful snapshot
    this.isReconnecting = false
  }

  private handleDelta(message: TableDeltaMessage): void {
    // Check schema version
    if (
      this.expectedSchemaVersion &&
      message.schema_version !== this.expectedSchemaVersion
    ) {
      console.error('[WS] Schema version mismatch in delta!', {
        expected: this.expectedSchemaVersion,
        received: message.schema_version,
      })
      this.updateState('version_mismatch')
      return
    }

    // Check table version
    if (
      this.expectedTableVersion !== null &&
      message.table_version !== this.expectedTableVersion
    ) {
      console.warn('[WS] Table version mismatch, requesting snapshot', {
        expected: this.expectedTableVersion,
        received: message.table_version,
      })
      this.requestSnapshot()
      return
    }

    // Case 1: Stale/Duplicate - ignore messages with seq <= expectedSeq
    if (this.expectedSeq !== null && message.event_seq <= this.expectedSeq) {
      console.debug('[WS] Ignoring stale/duplicate message', {
        expected: this.expectedSeq,
        received: message.event_seq,
      })
      return
    }

    // Case 2: Correct Sequence - seq === expectedSeq + 1
    if (this.expectedSeq !== null && message.event_seq === this.expectedSeq + 1) {
      // Apply the delta immediately
      this.applyDelta(message)

      // Recursively process any buffered messages that are now in sequence
      this.processBufferedMessages()
      return
    }

    // Case 3: Future Sequence - seq > expectedSeq + 1 (gap detected)
    if (this.expectedSeq !== null && message.event_seq > this.expectedSeq + 1) {
      console.warn('[WS] Future sequence detected, buffering message', {
        expected: this.expectedSeq + 1,
        received: message.event_seq,
        gap: message.event_seq - this.expectedSeq - 1,
      })

      // Store message in buffer
      this.messageBuffer.set(message.event_seq, message)

      // Start gap timeout if not already active
      if (!this.gapTimeout) {
        this.gapTimeout = setTimeout(() => {
          console.warn('[WS] Gap timeout, requesting snapshot')
          this.messageBuffer.clear()
          this.gapTimeout = null
          this.requestSnapshot()
        }, this.options.gapTimeoutMs)
      }
      return
    }

    // Edge case: first delta without expectedSeq set
    if (this.expectedSeq === null) {
      console.warn('[WS] Receiving delta without expectedSeq, applying anyway')
      this.applyDelta(message)
    }
  }

  /**
   * Apply a delta message and update tracking
   */
  private applyDelta(message: TableDeltaMessage): void {
    // Update tracking
    this.expectedSeq = message.event_seq
    this.expectedTableVersion = message.table_version

    // Merge delta with snapshot
    if (this.lastSnapshot) {
      this.lastSnapshot = {
        ...this.lastSnapshot,
        ...message.payload,
      }
    }

    // Notify handler
    this.options.onDelta(message)

    console.debug('[WS] Delta applied', {
      type: message.type,
      seq: message.event_seq,
    })
  }

  /**
   * Process buffered messages in sequence
   */
  private processBufferedMessages(): void {
    while (this.expectedSeq !== null) {
      const nextSeq = this.expectedSeq + 1
      const bufferedMessage = this.messageBuffer.get(nextSeq)

      if (!bufferedMessage) {
        // No more sequential messages in buffer
        break
      }

      // Remove from buffer
      this.messageBuffer.delete(nextSeq)

      // Apply the buffered message
      this.applyDelta(bufferedMessage)
    }

    // If buffer is empty after processing, clear the timeout
    if (this.messageBuffer.size === 0 && this.gapTimeout) {
      clearTimeout(this.gapTimeout)
      this.gapTimeout = null
    }
  }

  private handleError(error: Event): void {
    console.error('[WS] Error:', error)
    // Note: onclose will be called after onerror
  }

  private handleClose(event: CloseEvent): void {
    debugLog('disconnect', 'Connection closed', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    })
    
    console.log('[WS] Closed', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
    })

    this.clearTimers()
    this.updateState('disconnected')

    // Auto-reconnect if enabled
    if (this.options.autoReconnect) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer()

    // Exponential backoff
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.options.maxReconnectDelay
    )

    debugLog('reconnect', `Scheduling reconnect`, {
      delay,
      attempt: this.reconnectAttempts + 1,
    })
    
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()

    // Note: We send pong proactively as a keepalive. The server sends ping messages,
    // and we also respond to those in handleMessage. This dual approach ensures
    // connection stays alive even if server pings are delayed.
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.send({ type: 'pong' })
      }
    }, this.options.heartbeatInterval)
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private clearTimers(): void {
    this.clearHeartbeat()
    this.clearReconnectTimer()
    if (this.snapshotRefreshDebounceTimer) {
      clearTimeout(this.snapshotRefreshDebounceTimer)
      this.snapshotRefreshDebounceTimer = null
    }
  }

  private updateState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState
      this.options.onStateChange(newState)
      console.log('[WS] State changed:', newState)
    }
  }

  private isDeltaMessage(message: WebSocketMessage): boolean {
    return [
      'table_update',
      'seat_update',
      'player_update',
      'pot_update',
      'action_update',
      'timer_update',
    ].includes(message.type)
  }
}

/**
 * Factory function for table WebSocket
 */
export function createTableWebSocket(
  tableId: number | string,
  options: WebSocketManagerOptions
): WebSocketManager {
  const url = `/ws/${tableId}`
  return new WebSocketManager(url, options)
}

/**
 * Factory function for lobby WebSocket
 */
export function createLobbyWebSocket(
  options: WebSocketManagerOptions
): WebSocketManager {
  const url = '/ws/lobby'
  return new WebSocketManager(url, options)
}
