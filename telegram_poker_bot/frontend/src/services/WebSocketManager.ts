/**
 * Phase 5: WebSocket Manager
 * 
 * Manages WebSocket connections with:
 * - Heartbeat (ping/pong)
 * - Automatic reconnection with exponential backoff
 * - Snapshot syncing on connect
 * - Delta merging with sequence tracking
 * - Schema version mismatch detection
 */

import { resolveWebSocketUrl } from '../utils/apiClient'
import type {
  ConnectionState,
  TableDeltaMessage,
  NormalizedTableState,
  WebSocketMessage,
} from '../types/normalized'

type MessageHandler = (message: WebSocketMessage) => void
type StateChangeHandler = (state: ConnectionState) => void
type SnapshotHandler = (snapshot: NormalizedTableState) => void
type DeltaHandler = (delta: TableDeltaMessage) => void

interface WebSocketManagerOptions {
  onMessage?: MessageHandler
  onStateChange?: StateChangeHandler
  onSnapshot?: SnapshotHandler
  onDelta?: DeltaHandler
  autoReconnect?: boolean
  heartbeatInterval?: number // ms
  reconnectDelay?: number // ms (initial)
  maxReconnectDelay?: number // ms
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

  private readonly url: string
  private readonly options: Required<WebSocketManagerOptions>

  constructor(url: string, options: WebSocketManagerOptions = {}) {
    this.url = url
    this.options = {
      onMessage: options.onMessage || (() => {}),
      onStateChange: options.onStateChange || (() => {}),
      onSnapshot: options.onSnapshot || (() => {}),
      onDelta: options.onDelta || (() => {}),
      autoReconnect: options.autoReconnect ?? true,
      heartbeatInterval: options.heartbeatInterval || 25000, // 25s
      reconnectDelay: options.reconnectDelay || 1000, // 1s
      maxReconnectDelay: options.maxReconnectDelay || 30000, // 30s
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

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleOpen(): void {
    console.log('[WS] Connected')
    this.reconnectAttempts = 0
    
    // Start heartbeat
    this.startHeartbeat()
    
    // Request initial snapshot or use cached state
    if (this.lastSnapshot) {
      // We have cached state, request snapshot to verify
      this.requestSnapshot()
    } else {
      // First connection, expect snapshot from server
      this.updateState('syncing_snapshot')
    }
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
      if (message.type === 'snapshot') {
        this.handleSnapshot(message as TableDeltaMessage)
      } else if (this.isDeltaMessage(message)) {
        this.handleDelta(message as TableDeltaMessage)
      }
    } catch (error) {
      console.error('[WS] Failed to parse message:', error)
    }
  }

  private handleSnapshot(message: TableDeltaMessage): void {
    const snapshot = message.payload as NormalizedTableState

    // Check schema version
    if (
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

    // Store snapshot
    this.lastSnapshot = snapshot
    this.expectedSeq = message.event_seq
    this.expectedTableVersion = message.table_version
    this.expectedSchemaVersion = message.schema_version

    // Notify handlers
    this.options.onSnapshot(snapshot)
    this.updateState('live')

    console.log('[WS] Snapshot received', {
      table_version: message.table_version,
      event_seq: message.event_seq,
    })
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

    // Check sequence
    if (this.expectedSeq !== null && message.event_seq !== this.expectedSeq + 1) {
      console.warn('[WS] Sequence mismatch, requesting snapshot', {
        expected: this.expectedSeq + 1,
        received: message.event_seq,
      })
      this.requestSnapshot()
      return
    }

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

  private handleError(error: Event): void {
    console.error('[WS] Error:', error)
    // Note: onclose will be called after onerror
  }

  private handleClose(event: CloseEvent): void {
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

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()

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
