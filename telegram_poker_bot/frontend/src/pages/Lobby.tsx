import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRefresh, faQrcode, faUserGroup, faClock } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, type ApiFetchOptions, resolveWebSocketUrl } from '../utils/apiClient'
import GameVariantBadge from '../components/ui/GameVariantBadge'
import { extractRuleSummary } from '../utils/tableRules'
import type { TableInfo } from '../components/lobby/types'

type TabKey = 'public' | 'private' | 'my'

function normalizeTablesResponse<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const candidate = (data as any).tables ?? (data as any).items ?? (data as any).data
    if (Array.isArray(candidate)) return candidate as T[]
  }
  return []
}

export default function LobbyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { initData, ready } = useTelegram()
  const [activeTab, setActiveTab] = useState<TabKey>('public')
  const [publicTables, setPublicTables] = useState<TableInfo[]>([])
  const [myTables, setMyTables] = useState<TableInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const lobbySocketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const staleTableIdsRef = useRef<Set<number>>(new Set())

  const removeTableLocally = useCallback((tableId: number) => {
    staleTableIdsRef.current.add(tableId)
    setPublicTables((previous) => previous.filter((table) => table.table_id !== tableId))
    setMyTables((previous) => previous.filter((table) => table.table_id !== tableId))
  }, [])

  const loadTables = useCallback(async () => {
    if (!ready) return
    
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setLoading(true)
      const options: ApiFetchOptions = { signal: controller.signal }
      if (initData) options.initData = initData

      const [publicData, myData] = await Promise.all([
        apiFetch<unknown>('/tables', { ...options, query: { scope: 'public' } }).then(normalizeTablesResponse<TableInfo>),
        initData ? apiFetch<unknown>('/users/me/tables', options).then(normalizeTablesResponse<TableInfo>) : Promise.resolve([])
      ])

      if (controller.signal.aborted) return

      const filteredPublic = publicData.filter((table) => !staleTableIdsRef.current.has(table.table_id))
      const filteredMy = myData.filter((table) => !staleTableIdsRef.current.has(table.table_id))

      setPublicTables(filteredPublic)
      setMyTables(filteredMy)
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Error loading tables:', error)
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [ready, initData])

  const handleLobbyMessage = useCallback(
    (payload: any) => {
      const messageType = payload?.type
      if (!messageType) return

      if (messageType === 'TABLE_REMOVED') {
        const tableId = Number(payload.table_id ?? payload.tableId)
        if (Number.isFinite(tableId)) {
          removeTableLocally(tableId)
        }
        return
      }

      if (messageType === 'LOBBY_UPDATE_REQUIRED') {
        loadTables()
      }
    },
    [loadTables, removeTableLocally],
  )

  const connectLobbySocket = useCallback(() => {
    if (!ready) return
    if (lobbySocketRef.current && lobbySocketRef.current.readyState === WebSocket.OPEN) {
      return
    }

    if (lobbySocketRef.current) {
      lobbySocketRef.current.close()
    }

    try {
      const wsUrl = resolveWebSocketUrl('/ws/lobby')
      const socket = new WebSocket(wsUrl)
      lobbySocketRef.current = socket

      socket.onopen = () => {
        console.log('[Lobby WebSocket] Connected')
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data?.type === 'ping') {
            socket.send(JSON.stringify({ type: 'pong' }))
            return
          }
          handleLobbyMessage(data)
        } catch (error) {
          console.warn('[Lobby WebSocket] Failed to parse message', error)
        }
      }

      socket.onerror = (error) => {
        console.error('[Lobby WebSocket] Error', error)
      }

      socket.onclose = () => {
        console.log('[Lobby WebSocket] Disconnected')
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        reconnectTimeoutRef.current = window.setTimeout(connectLobbySocket, 1500)
      }
    } catch (error) {
      console.error('[Lobby WebSocket] Failed to connect', error)
    }
  }, [handleLobbyMessage, ready])

  useEffect(() => {
    loadTables()
    return () => abortControllerRef.current?.abort()
  }, [loadTables])

  useEffect(() => {
    connectLobbySocket()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (lobbySocketRef.current) {
        lobbySocketRef.current.close()
        lobbySocketRef.current = null
      }
    }
  }, [connectLobbySocket])

  useEffect(() => {
    const handleLocalRemoval = (event: Event) => {
      const detail = (event as CustomEvent<{ tableId?: number | string }>).detail
      if (!detail?.tableId && detail?.tableId !== 0) return
      const tableId = Number(detail.tableId)
      if (!Number.isFinite(tableId)) return
      removeTableLocally(tableId)
    }

    window.addEventListener('lobby:table-removed', handleLocalRemoval)
    return () => window.removeEventListener('lobby:table-removed', handleLocalRemoval)
  }, [removeTableLocally])

  const handleJoinInvite = () => {
    if (inviteCode.trim()) {
      navigate(`/games/join?code=${inviteCode.trim()}`)
    }
  }

  const currentTables = (activeTab === 'my' ? myTables : activeTab === 'public' ? publicTables : []).filter((table) => {
    if (staleTableIdsRef.current.has(table.table_id)) return false
    // Filter out expired tables
    if (table.status === 'expired') return false
    if (table.expires_at) {
      const expiryTime = new Date(table.expires_at).getTime()
      if (expiryTime <= Date.now()) return false
    }
    return true
  })
  const persistentTables = currentTables.filter((table) => table.is_persistent)
  const onDemandTables = currentTables.filter((table) => !table.is_persistent)

  const renderTableButton = (table: TableInfo) => (
    <button
      key={table.table_id}
      onClick={() => navigate(`/table/${table.table_id}`)}
      className="flex w-full items-center justify-between rounded-xl p-4 text-left transition-transform active:scale-98"
      style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
      }}
    >
      <div className="flex-1">
        {(() => {
          const rules = extractRuleSummary(table.template, {
            max_players: table.max_players,
            currency_type: table.currency_type,
            table_name: table.table_name ?? null,
          })
          const maxPlayers = rules.maxPlayers ?? table.max_players
          const stakes = rules.stakesLabel ?? '—'
          const name = rules.tableName ?? table.table_name ?? `Table #${table.table_id}`

          return (
            <>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {name}
                </p>
                <span
                  className="rounded-lg px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: 'var(--color-success-bg)',
                    color: 'var(--color-success-text)',
                  }}
                >
                  {table.status || 'Active'}
                </span>
                <GameVariantBadge variant={table.game_variant} size="sm" />
                {table.is_persistent && (
                  <span
                    className="rounded-lg px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                    style={{
                      background: 'var(--glass-bg-elevated)',
                      color: 'var(--color-text-muted)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    {t('lobby.persistent.label', 'Persistent')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="flex items-center gap-1">
                  <span>{t('table.meta.stakes', { defaultValue: 'Stakes' })} {stakes}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon icon={faUserGroup} className="text-xs" />
                  <span>{table.player_count}/{maxPlayers}</span>
                </span>
                {table.expires_at && !table.is_persistent && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <FontAwesomeIcon icon={faClock} className="text-xs" />
                      <span>{new Date(table.expires_at).toLocaleTimeString()}</span>
                    </span>
                  </>
                )}
              </div>
            </>
          )
        })()}
      </div>
      <span
        className="rounded-lg px-4 py-2 text-sm font-semibold"
        style={{
          background: 'var(--color-accent-soft)',
          color: 'var(--color-accent)',
        }}
      >
        {t('lobby.actions.join', 'Join')}
      </span>
    </button>
  )

  if (!ready || loading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center rounded-2xl"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('lobby.title', 'Lobby')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('lobby.availableTables.subtitle', 'Browse and join tables')}
            </p>
          </div>
          <button
            onClick={loadTables}
            className="rounded-xl px-3 py-2 text-sm font-medium transition-transform active:scale-95"
            style={{
              background: 'var(--glass-bg-elevated)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text)',
            }}
          >
            <FontAwesomeIcon icon={faRefresh} />
          </button>
        </div>
      </div>

      <div
        className="flex gap-2 rounded-2xl p-2"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {[
          { key: 'public', label: t('lobby.tabs.public', 'Public') },
          { key: 'private', label: t('lobby.tabs.private', 'Private') },
          { key: 'my', label: t('lobby.tabs.my', 'My Tables') }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className="flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all"
            style={{
              background: activeTab === tab.key ? 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'private' ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('lobby.empty.private', 'Private tables coming soon')}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('lobby.sections.persistent', 'Persistent Lobbies')}
            </h2>
            {persistentTables.length === 0 ? (
              <div
                className="rounded-2xl p-4 text-sm"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {t('lobby.sections.persistentEmpty', 'No persistent lobbies yet.')}
              </div>
            ) : (
              <div className="space-y-2">
                {persistentTables.map(renderTableButton)}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('lobby.sections.custom', 'Custom Games')}
            </h2>
            {onDemandTables.length === 0 ? (
              <div
                className="rounded-2xl p-4 text-sm"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                <p className="mb-4">
                  {activeTab === 'my'
                    ? t('lobby.myTables.empty', 'No active tables')
                    : t('lobby.availableTables.empty', 'No public tables right now')}
                </p>
                <button
                  onClick={() => navigate('/games/create')}
                  className="rounded-xl px-6 py-3 font-semibold transition-transform active:scale-98"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))',
                    color: '#fff',
                    boxShadow: 'var(--shadow-button)',
                  }}
                >
                  {t('lobby.empty.createPublic', 'Create a public table')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {onDemandTables.map(renderTableButton)}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {t('lobby.inviteCode.label', 'Join with invite code')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder={t('lobby.inviteCode.placeholder', 'Enter code')}
            className="flex-1 rounded-xl px-4 py-3 text-sm uppercase tracking-wider"
            style={{
              background: 'var(--glass-bg-elevated)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text)',
            }}
          />
          <button
            onClick={handleJoinInvite}
            className="rounded-xl px-6 py-3 font-semibold"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))',
              color: '#fff',
            }}
          >
            {t('lobby.actions.join', 'Join')}
          </button>
        </div>
      </div>

      <button
        onClick={() => navigate('/games/join')}
        className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-4 transition-transform active:scale-98"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <FontAwesomeIcon icon={faQrcode} className="text-2xl" style={{ color: 'var(--color-text)' }} />
        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('lobby.qrJoin.label', 'Join via QR')}
        </span>
      </button>
    </div>
  )
}
