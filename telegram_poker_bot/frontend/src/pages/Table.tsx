import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { faUser, faCoins, faUserGroup, faClock } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { useTableWebSocket } from '../hooks/useTableWebSocket'
import { apiFetch, ApiError } from '../utils/apiClient'
import Toast from '../components/Toast'
import Countdown from '../components/Countdown'
import Card from '../components/ui/Card'
import PlayingCard from '../components/ui/PlayingCard'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ConnectionStatus from '../components/ui/ConnectionStatus'
import TableSummary from '../components/tables/TableSummary'
import ExpiredTableView from '../components/tables/ExpiredTableView'
import InviteSection from '../components/tables/InviteSection'
import TableActionButtons from '../components/tables/TableActionButtons'
import type { TableStatusTone } from '../components/lobby/types'

interface TablePlayer {
  user_id: number
  username?: string | null
  display_name?: string | null
  position: number
  chips: number
  joined_at?: string | null
  is_host?: boolean
}

interface TableViewerInfo {
  user_id: number | null
  is_creator: boolean
  is_seated: boolean
  seat_position?: number | null
}

interface TablePermissions {
  can_start: boolean
  can_join: boolean
  can_leave?: boolean
}

interface TableHostInfo {
  user_id: number
  username?: string | null
  display_name?: string | null
}

interface TableInviteInfo {
  game_id?: string
  status?: string
  expires_at?: string | null
}

interface TableDetails {
  table_id: number
  table_name?: string | null
  mode?: string
  status: string
  small_blind: number
  big_blind: number
  starting_stack: number
  player_count: number
  max_players: number
  created_at?: string | null
  updated_at?: string | null
  expires_at?: string | null
  is_expired?: boolean
  invite_code?: string | null
  host?: TableHostInfo | null
  players?: TablePlayer[]
  viewer?: TableViewerInfo | null
  permissions?: TablePermissions | null
  invite?: TableInviteInfo | null
  is_private?: boolean
  is_public?: boolean
  visibility?: 'public' | 'private'
  group_title?: string | null
}

interface LivePlayerState {
  user_id: number
  seat: number
  stack: number
  bet: number
  in_hand: boolean
  is_button: boolean
  is_small_blind: boolean
  is_big_blind: boolean
  acted?: boolean
  display_name?: string | null
}

interface LiveHeroState {
  user_id: number
  cards: string[]
}

interface HandWinnerResult {
  user_id: number
  amount: number
  hand_score: number
  hand_rank: string
  best_hand_cards?: string[]
}

interface LiveTableState {
  type: 'table_state'
  table_id: number
  hand_id: number | null
  status: string
  street: string | null
  board: string[]
  pot: number
  current_bet: number
  min_raise: number
  current_actor: number | null
  action_deadline?: string | null
  players: LivePlayerState[]
  hero: LiveHeroState | null
  last_action?: Record<string, unknown> | null
  hand_result?: { winners: HandWinnerResult[] } | null
}

const DEFAULT_TOAST = { message: '', visible: false }

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { initData } = useTelegram()
  const { t } = useTranslation()

  const [tableDetails, setTableDetails] = useState<TableDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSeating, setIsSeating] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toast, setToast] = useState(DEFAULT_TOAST)
  const [liveState, setLiveState] = useState<LiveTableState | null>(null)
  const [handResult, setHandResult] = useState<LiveTableState['hand_result'] | null>(null)
  const [actionPending, setActionPending] = useState(false)

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  )

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true })
    window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 2400)
  }, [])

  // Use ref to store the latest initData to avoid recreating fetchTable
  const initDataRef = useRef(initData)
  useEffect(() => {
    initDataRef.current = initData
  }, [initData])

  // Track the last hand_id to detect when a new hand starts
  const lastHandIdRef = useRef<number | null>(null)

  const fetchTable = useCallback(async () => {
    if (!tableId) {
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<TableDetails>(`/tables/${tableId}`, {
        method: 'GET',
        initData: initDataRef.current ?? undefined,
      })
      setTableDetails(data)
    } catch (err) {
      console.error('Error fetching table:', err)
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError(t('table.errors.notFound'))
        } else if (err.status === 401) {
          setError(t('table.errors.unauthorized'))
        } else {
          setError(t('table.errors.loadFailed'))
        }
      } else {
        setError(t('table.errors.loadFailed'))
      }
      setTableDetails(null)
    } finally {
      setLoading(false)
    }
  }, [tableId, t])

  const fetchLiveState = useCallback(async () => {
    if (!tableId) {
      return
    }
    try {
      const data = await apiFetch<LiveTableState>(`/tables/${tableId}/state`, {
        method: 'GET',
        initData: initDataRef.current ?? undefined,
      })
      setLiveState(data)
      setHandResult(data.hand_result ?? null)
    } catch (err) {
      console.warn('Unable to fetch live state', err)
    }
  }, [tableId])

  // Refresh table data once auth context (initData) becomes available so the
  // viewer-specific fields (like seat status and hero cards) are populated.
  useEffect(() => {
    if (!tableId || !initData) {
      return
    }
    fetchTable()
    fetchLiveState()
  }, [fetchLiveState, fetchTable, initData, tableId])

  // Initial data fetch on mount
  useEffect(() => {
    if (!tableId) {
      return
    }
    fetchTable()
    fetchLiveState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]) // Only depend on tableId, not the fetch functions (which are stable via useCallback)

  // WebSocket connection with stable hook
  const { status: wsStatus } = useTableWebSocket({
    tableId: tableId || '',
    enabled: !!tableId,
    onMessage: useCallback((payload: any) => {
      // Handle different message types
      if (
        payload?.type === 'action' ||
        payload?.type === 'table_started' ||
        payload?.type === 'player_joined' ||
        payload?.type === 'player_left'
      ) {
        // Refetch table details on player/game state changes
        fetchTable()
      }
    }, [fetchTable]),
    onStateChange: useCallback((payload: LiveTableState) => {
      const isNewHand =
        payload.hand_id !== null && lastHandIdRef.current !== payload.hand_id

      setLiveState((previous) => {
        const isSameHand =
          payload.hand_id !== null && previous?.hand_id === payload.hand_id

        // Preserve viewer-specific data (like hero cards) when the broadcast
        // payload omits it. WebSocket broadcasts are public, so they don't
        // include the viewer's hole cards, which we need to keep showing.
        const mergedHero = payload.hero ?? (isSameHand ? previous?.hero ?? null : null)

        // Keep hand result while the hand is still the same
        const mergedHandResult =
          payload.hand_result ?? (isSameHand ? previous?.hand_result ?? null : null)

        const nextState: LiveTableState = {
          ...payload,
          hero: mergedHero,
          hand_result: mergedHandResult,
        }

        setHandResult(mergedHandResult ?? null)
        return nextState
      })

      // When a new hand starts, fetch viewer-specific state (including hero cards)
      if (isNewHand && payload.hand_id !== null) {
        lastHandIdRef.current = payload.hand_id
        fetchLiveState()
      }
    }, [fetchLiveState]),
    onConnect: useCallback(() => {
      console.log('WebSocket connected to table', tableId)
      // Refresh viewer-specific state (including hero cards) after reconnects
      fetchLiveState()
    }, [fetchLiveState, tableId]),
    onDisconnect: useCallback(() => {
      console.log('WebSocket disconnected from table', tableId)
    }, [tableId]),
  })

  const handleSeat = async () => {
    if (!tableId) {
      return
    }
    if (!initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    try {
      setIsSeating(true)
      await apiFetch(`/tables/${tableId}/sit`, {
        method: 'POST',
        initData,
      })
      showToast(t('table.toast.seated'))
      await fetchTable()
      await fetchLiveState()
    } catch (err) {
      console.error('Error taking seat:', err)
      if (err instanceof ApiError) {
        const message =
          (typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : null) || t('table.errors.actionFailed')
        showToast(message)
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    } finally {
      setIsSeating(false)
    }
  }

  const handleLeave = async () => {
    if (!tableId) {
      return
    }
    if (!initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    try {
      setIsLeaving(true)
      await apiFetch(`/tables/${tableId}/leave`, {
        method: 'POST',
        initData,
      })
      showToast(t('table.toast.left'))
      await fetchTable()
    } catch (err) {
      console.error('Error leaving seat:', err)
      if (err instanceof ApiError) {
        const message =
          (typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : null) || t('table.errors.actionFailed')
        showToast(message)
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    } finally {
      setIsLeaving(false)
    }
  }

  const handleStart = async () => {
    if (!tableId) {
      return
    }
    if (!initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    try {
      setIsStarting(true)
      const state = await apiFetch<LiveTableState>(`/tables/${tableId}/start`, {
        method: 'POST',
        initData,
      })
      setLiveState(state)
      setHandResult(state.hand_result ?? null)
      await fetchTable()
      await fetchLiveState()
      showToast(t('table.toast.started'))
    } catch (err) {
      console.error('Error starting table:', err)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          showToast(t('table.errors.startNotAllowed'))
        } else {
          const message =
            (typeof err.data === 'object' && err.data && 'detail' in err.data
              ? String((err.data as { detail?: unknown }).detail)
              : null) || t('table.errors.actionFailed')
          showToast(message)
        }
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    } finally {
      setIsStarting(false)
    }
  }

  const sendAction = async (actionType: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount?: number) => {
    if (!tableId || !initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    try {
      setActionPending(true)
      const state = await apiFetch<LiveTableState>(`/tables/${tableId}/actions`, {
        method: 'POST',
        initData,
        body: {
          action_type: actionType,
          amount,
        },
      })
      setLiveState(state)
      setHandResult(state.hand_result ?? null)
      await fetchLiveState()
    } catch (err) {
      console.error('Error sending action', err)
      if (err instanceof ApiError) {
        const message =
          (typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : null) || t('table.errors.actionFailed')
        showToast(message)
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    } finally {
      setActionPending(false)
    }
  }

  const handleDeleteTable = async () => {
    if (!tableId) {
      return
    }
    if (!initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    try {
      setIsDeleting(true)
      await apiFetch(`/tables/${tableId}`, {
        method: 'DELETE',
        initData,
      })
      showToast(t('table.toast.deleted'))
      // Redirect to lobby after deletion
      setTimeout(() => {
        navigate('/lobby', { replace: true })
      }, 1000)
    } catch (err) {
      console.error('Error deleting table:', err)
      if (err instanceof ApiError) {
        const message =
          (typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : null) || t('table.errors.deleteFailed')
        showToast(message)
      } else {
        showToast(t('table.errors.deleteFailed'))
      }
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  if (!tableId) {
    return (
      <Card className="flex min-h-[50vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('table.notFound')}
      </Card>
    )
  }

  if (loading) {
    return (
      <Card className="flex min-h-[50vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('table.loading')}
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center text-sm text-[color:var(--text-muted)]">
        <p>{error}</p>
        <Button variant="primary" onClick={fetchTable}>
          {t('table.actions.retry')}
        </Button>
      </Card>
    )
  }

  if (!tableDetails) {
    return (
      <Card className="flex min-h-[50vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('table.notFound')}
      </Card>
    )
  }

  // Check if table is expired
  if (tableDetails.is_expired || tableDetails.status?.toLowerCase() === 'expired') {
    return (
      <ExpiredTableView
        tableName={tableDetails.table_name}
        smallBlind={tableDetails.small_blind}
        bigBlind={tableDetails.big_blind}
        startingStack={tableDetails.starting_stack}
        maxPlayers={tableDetails.max_players}
        isPrivate={tableDetails.visibility === 'private' || tableDetails.is_private}
      />
    )
  }

  const createdAtText = tableDetails.created_at
    ? dateFormatter.format(new Date(tableDetails.created_at))
    : null
  const viewerIsCreator = tableDetails.viewer?.is_creator ?? false
  const viewerIsSeated = tableDetails.viewer?.is_seated ?? false
  const canStart = tableDetails.permissions?.can_start ?? false
  const canJoin = tableDetails.permissions?.can_join ?? false
  const canLeave = tableDetails.permissions?.can_leave ?? false
  const missingPlayers = Math.max(0, 2 - tableDetails.player_count)
  const players = (tableDetails.players || []).slice().sort((a, b) => a.position - b.position)
  const tableName = tableDetails.table_name || `Table #${tableDetails.table_id}`
  const hostName = tableDetails.host?.display_name || tableDetails.host?.username || null
  const statusLabel = t(`table.status.${tableDetails.status.toLowerCase()}` as const, {
    defaultValue: tableDetails.status,
  })
  const statusTone: TableStatusTone =
    tableDetails.status.toLowerCase() === 'active'
      ? 'running'
      : tableDetails.status.toLowerCase() === 'ended'
      ? 'finished'
      : 'waiting'
  const heroId = liveState?.hero?.user_id ?? null
  const heroPlayer = liveState?.players.find((p) => p.user_id === heroId)
  const amountToCall = Math.max((liveState?.current_bet ?? 0) - (heroPlayer?.bet ?? 0), 0)
  const heroCards = liveState?.hero?.cards ?? []

  return (
    <div className="space-y-4">
      <Toast message={toast.message} visible={toast.visible} />
      
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={t('table.confirmDelete.message')}
        description={t('table.confirmDelete.warning')}
        confirmLabel={isDeleting ? t('common.loading') : t('table.confirmDelete.confirm')}
        cancelLabel={t('table.confirmDelete.cancel')}
        onConfirm={handleDeleteTable}
        confirmVariant="danger"
        confirmDisabled={isDeleting}
      />
      
      <TableSummary
        tableName={tableName}
        chipLabel={`${tableDetails.small_blind}/${tableDetails.big_blind}`}
        statusBadge={{ label: statusLabel, tone: statusTone }}
        meta={[
          {
            icon: faUser,
            label: t('table.meta.host'),
            value: hostName || t('table.meta.unknown'),
          },
          {
            icon: faCoins,
            label: t('table.meta.stakes'),
            value: `${tableDetails.small_blind}/${tableDetails.big_blind} • ${t('table.stacks', { amount: tableDetails.starting_stack })}`,
          },
          {
            icon: faUserGroup,
            label: t('table.meta.players'),
            value: `${tableDetails.player_count} / ${tableDetails.max_players}`,
          },
          {
            icon: faClock,
            label: t('table.meta.created'),
            value: createdAtText || '—',
          },
        ]}
        badges={[
          tableDetails.visibility
            ? {
                label: t(`table.visibility.${tableDetails.visibility}` as const, {
                  defaultValue: tableDetails.visibility,
                }),
                tone: 'visibility',
              }
            : undefined,
          viewerIsCreator
            ? { label: t('table.labels.youHost'), tone: 'host' }
            : viewerIsSeated
            ? { label: t('table.labels.seated'), tone: 'seated' }
            : undefined,
        ].filter(Boolean) as { label: string; tone: 'visibility' | 'host' | 'seated' }[]}
        subtext={tableDetails.group_title ? t('table.groupTag', { value: tableDetails.group_title }) : undefined}
        expiresAt={tableDetails.expires_at ?? null}
      />

      {/* WebSocket Connection Status */}
      <Card className="py-2">
        <ConnectionStatus status={wsStatus} />
      </Card>

      {liveState && (
        <Card className="glass-panel border border-white/10 bg-white/5 shadow-lg">
          {/* Game Status Header - Compact */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)] mb-0.5">
                {t('table.statusLabel')}
              </p>
              <p className="text-base font-semibold text-[color:var(--text-primary)]">
                {liveState.street?.toUpperCase() || t('table.status.waiting')}
              </p>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <p className="text-[10px] text-[color:var(--text-muted)] mb-0.5">{t('table.pot')}</p>
              <p className="text-sm font-bold text-emerald-400">{liveState.pot}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-[color:var(--text-muted)] mb-0.5">{t('table.blinds')}</p>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                {`${tableDetails.small_blind}/${tableDetails.big_blind}`}
              </p>
            </div>
          </div>

          {/* Community Cards */}
          <div className="py-3">
            <div className="flex items-center justify-center gap-1.5">
              {liveState.board && liveState.board.length > 0 ? (
                liveState.board.map((card, idx) => <PlayingCard key={`board-${idx}`} card={card} size="md" />)
              ) : (
                <div className="rounded-lg bg-black/20 px-3 py-2 text-xs text-[color:var(--text-muted)]">
                  {t('table.waitingForBoard')}
                </div>
              )}
            </div>
          </div>

          {/* Players Grid - More Compact */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 py-3 border-t border-white/10">
            {liveState.players.map((player) => {
              const isActor = player.user_id === liveState.current_actor
              const isHero = player.user_id === heroId
              return (
                <div
                  key={`${player.user_id}-${player.seat}`}
                  className={`rounded-lg border px-2.5 py-2 backdrop-blur-sm transition-all ${
                    isActor
                      ? 'border-emerald-400/60 bg-emerald-500/5 shadow-md shadow-emerald-500/10'
                      : isHero
                      ? 'border-sky-400/40 bg-sky-500/5'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[color:var(--text-primary)] truncate">
                      {player.display_name || t('table.players.seat', { index: player.seat + 1 })}
                    </span>
                    <div className="flex gap-0.5 text-[9px] uppercase tracking-wide">
                      {player.is_button && (
                        <span className="rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.5">D</span>
                      )}
                      {player.is_small_blind && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5">SB</span>
                      )}
                      {player.is_big_blind && (
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5">BB</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-[color:var(--text-muted)]">
                      {t('table.chips', { amount: player.stack })}
                    </span>
                    {player.bet > 0 && (
                      <span className="text-amber-400 font-semibold">
                        {t('table.betAmount', { amount: player.bet })}
                      </span>
                    )}
                  </div>
                  {!player.in_hand && (
                    <p className="mt-1 text-[10px] text-rose-400/80">{t('table.folded')}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Hero Cards - Compact */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex flex-col items-center gap-2 rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-transparent px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)]">
                {t('table.yourHand')}
              </p>
              <div className="flex gap-1.5">
                {heroCards.length ? (
                  heroCards.map((card, idx) => <PlayingCard key={`hero-${idx}`} card={card} size="md" />)
                ) : (
                  <span className="text-xs text-[color:var(--text-muted)]">
                    {t('table.waitingForHand')}
                  </span>
                              )}
              </div>
              {handResult && handResult.winners && handResult.winners.length > 0 && (
                <div className="text-xs font-semibold space-y-1">
                  {handResult.winners.some((w) => w.user_id === heroId) ? (
                    <>
                      <div className="text-emerald-400">
                        {t('table.result.won', {
                          amount: handResult.winners.find((w) => w.user_id === heroId)?.amount,
                        })}
                      </div>
                      {(() => {
                        const heroWinner = handResult.winners.find((w) => w.user_id === heroId)
                        const handRank = heroWinner?.hand_rank
                        if (handRank && handRank !== 'folded') {
                          return (
                            <div className="text-[color:var(--text-muted)]">
                              {t(`table.result.handRank.${handRank}`, handRank.replace(/_/g, ' '))}
                            </div>
                          )
                        }
                        return null
                      })()}
                    </>
                  ) : (
                    <span className="text-rose-400">{t('table.result.lost')}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {liveState && viewerIsSeated && (
        <Card className="glass-panel border border-white/10 bg-white/5">
          <TableActionButtons
            isPlayerTurn={liveState.current_actor === heroId}
            amountToCall={amountToCall}
            minRaise={liveState.min_raise}
            playerStack={heroPlayer?.stack || 0}
            playerBet={heroPlayer?.bet || 0}
            actionPending={actionPending}
            onFold={() => sendAction('fold')}
            onCheckCall={() => sendAction(amountToCall > 0 ? 'call' : 'check')}
            onBet={() => sendAction('bet', liveState.min_raise || tableDetails.big_blind)}
            onRaise={() => sendAction('raise', Math.max(liveState.current_bet + liveState.min_raise, tableDetails.big_blind))}
            onAllIn={() => sendAction('raise', (heroPlayer?.stack || 0) + (heroPlayer?.bet || 0))}
          />
        </Card>
      )}

      {/* Invite Code Section (for private tables) */}
      {tableDetails.visibility === 'private' && tableDetails.invite_code && (viewerIsCreator || viewerIsSeated) && (
        <InviteSection
          inviteCode={tableDetails.invite_code}
          expiresAt={tableDetails.expires_at}
          onCopySuccess={() => showToast(t('table.invite.copied'))}
          onCopyError={() => showToast(t('table.errors.actionFailed'))}
        />
      )}

      {/* Countdown Timer (for all tables) */}
      {tableDetails.expires_at && (
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-xs font-semibold text-[color:var(--text-primary)]">
                {t('table.expiration.title', { defaultValue: 'Table Expires In' })}
              </h3>
              <p className="mt-0.5 text-[10px] text-[color:var(--text-muted)]">
                {t('table.expiration.hint', { defaultValue: 'This table will automatically close when time runs out.' })}
              </p>
            </div>
            <div className="text-right">
              <Countdown 
                expiresAt={tableDetails.expires_at} 
                className="text-lg font-bold text-[color:var(--text-primary)]"
                onExpire={() => {
                  showToast(t('table.expiration.expired', { defaultValue: 'Table has expired' }))
                  setTimeout(() => navigate('/lobby'), 2000)
                }}
              />
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">
            {t('table.players.title')}
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchTable}>
            {t('table.actions.refresh')}
          </Button>
        </div>
        {players.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-[color:var(--surface-border)] px-3 py-3 text-xs text-[color:var(--text-muted)]">
            {t('table.players.empty')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {players.map((player) => (
              <li
                key={`${player.user_id}-${player.position}`}
                className="flex items-center justify-between rounded-lg border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] px-3 py-2.5 text-xs"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[color:var(--text-primary)] truncate">
                    {t('table.players.seat', { index: player.position + 1 })}
                  </p>
                  <p className="text-[10px] text-[color:var(--text-muted)] truncate">
                    {player.display_name || player.username || t('table.meta.unknown')}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-right ml-2">
                  <div>
                    <p className="font-semibold text-[color:var(--text-primary)] text-xs">
                      {t('table.chips', { amount: player.chips })}
                    </p>
                    <div className="mt-0.5 flex gap-1 justify-end">
                      {player.is_host && (
                        <Badge variant="success" size="sm">
                          {t('table.players.hostTag')}
                        </Badge>
                      )}
                      {tableDetails.viewer?.user_id === player.user_id && (
                        <Badge variant="info" size="sm">
                          {t('table.players.youTag')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[color:var(--text-primary)] mb-3">
          {viewerIsCreator ? t('table.actions.titleHost') : t('table.actions.titleGuest')}
        </h2>
        <div className="flex flex-col gap-3">
          {/* Join/Leave seat actions */}
          <div className="flex flex-col gap-1.5">
            {viewerIsSeated ? (
              <Button
                variant="secondary"
                size="md"
                block
                onClick={handleLeave}
                disabled={!canLeave || isLeaving}
              >
                {isLeaving ? t('table.actions.leaving') : t('table.actions.leave')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                block
                onClick={handleSeat}
                disabled={!canJoin || isSeating}
              >
                {isSeating ? t('table.actions.joining') : t('table.actions.takeSeat')}
              </Button>
            )}
            <p className="text-[10px] text-[color:var(--text-muted)] px-1">
              {viewerIsSeated
                ? viewerIsCreator
                  ? canStart
                    ? t('table.messages.readyToStart')
                    : t('table.messages.waitForPlayers', { count: missingPlayers })
                  : t('table.messages.waitingForHost')
                : canJoin
                ? t('table.messages.joinPrompt')
                : t('table.messages.tableFull')}
            </p>
          </div>

          {/* Host-only actions */}
          {viewerIsCreator && (
            <>
              <div className="flex flex-col gap-1.5">
                <Button
                  variant="primary"
                  size="md"
                  block
                  glow={canStart}
                  onClick={handleStart}
                  disabled={!canStart || isStarting}
                >
                  {isStarting ? t('table.actions.starting') : t('table.actions.start')}
                </Button>
                {!canStart && missingPlayers > 0 && (
                  <p className="text-[10px] text-amber-400 px-1">
                    ⚠️ {t('table.messages.waitForPlayers', { count: missingPlayers })}
                  </p>
                )}
                {canStart && (
                  <p className="text-[10px] text-emerald-400 px-1">
                    ✓ {t('table.messages.readyToStart')}
                  </p>
                )}
              </div>

              {/* Delete table section */}
              <Button
                variant="danger"
                size="sm"
                block
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
              >
                {t('table.actions.delete')}
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
