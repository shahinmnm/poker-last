import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { useTableWebSocket } from '../hooks/useTableWebSocket'
import { useUserData } from '../providers/UserDataProvider'
import { useLayout } from '../providers/LayoutProvider'
import { apiFetch, ApiError } from '../utils/apiClient'
import Toast from '../components/Toast'
import Card from '../components/ui/Card'
import PlayingCard from '../components/ui/PlayingCard'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ExpiredTableView from '../components/tables/ExpiredTableView'
import HandResultPanel from '../components/tables/HandResultPanel'
import RecentHandsModal from '../components/tables/RecentHandsModal'
import TableExpiredModal from '../components/tables/TableExpiredModal'
import { ChipFlyManager, type ChipAnimation } from '../components/tables/ChipFly'
import WinnerShowcase from '../components/tables/WinnerShowcase'
import PokerFeltBackground from '../components/background/PokerFeltBackground'
import PlayerAvatar from '../components/tables/PlayerAvatar'
import TableLayoutV2 from '../components/tables/v2/TableLayoutV2'
import TableInfoPill from '../components/tables/v2/TableInfoPill'
import PlayerRing from '../components/tables/v2/PlayerRing'
import BoardAndPot from '../components/tables/v2/BoardAndPot'
import ActionSurface from '../components/tables/v2/ActionSurface'
import type {
  AllowedAction,
  AllowedActionsPayload,
  HandResultPayload,
  TablePlayerState,
  TableState,
} from '@/types/game'

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

type LastAction = NonNullable<TableState['last_action']>

const DEFAULT_TOAST = { message: '', visible: false }
const EXPIRED_TABLE_REDIRECT_DELAY_MS = 2000
const DEFAULT_TURN_TIMEOUT_SECONDS = 25
/**
 * Street names that indicate active gameplay.
 * During gameplay, liveState.status contains the current street name (preflop, flop, turn, river)
 * rather than 'active'. Action buttons should be shown when tableStatus is one of these values.
 */
export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { initData } = useTelegram()
  const { t } = useTranslation()
  const { refetchAll: refetchUserData } = useUserData()
  const { setShowBottomNav } = useLayout()

  const [tableDetails, setTableDetails] = useState<TableDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSeating, setIsSeating] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toast, setToast] = useState(DEFAULT_TOAST)
  const [liveState, setLiveState] = useState<TableState | null>(null)
  const [lastHandResult, setLastHandResult] =
    useState<TableState['hand_result'] | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [chipAnimations, setChipAnimations] = useState<ChipAnimation[]>([])
  const [showRecentHands, setShowRecentHands] = useState(false)

  const [showTableExpiredModal, setShowTableExpiredModal] = useState(false)
  const [tableExpiredReason, setTableExpiredReason] = useState('')

  const autoTimeoutRef = useRef<{ handId: number | null; count: number }>({ handId: null, count: 0 })
  const autoActionTimerRef = useRef<number | null>(null)
  
  // Refs for tracking elements for animations
  const playerTileRefs = useRef<Map<string, HTMLElement>>(new Map())
  const potAreaRef = useRef<HTMLDivElement | null>(null)
  const lastActionRef = useRef<LastAction | null>(null)
  const lastHandResultRef = useRef<TableState['hand_result'] | null>(null)
  const lastCompletedHandIdRef = useRef<number | null>(null)
  const lastHandResultHandIdRef = useRef<number | null>(null)
  
  // Track inter-hand state for logging only when it changes
  const prevIsInterHandRef = useRef<boolean | null>(null)

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

  const syncHandResults = useCallback(
    (
      handId: number | null,
      incomingResult: TableState['hand_result'] | null,
      isSameHand = false,
    ) => {
      if (incomingResult) {
        setLastHandResult(incomingResult)
        if (handId !== null) {
          lastHandResultHandIdRef.current = handId
        }
        return
      }

      if (!isSameHand) {
        setLastHandResult(null)
        lastHandResultHandIdRef.current = handId
      }
    },
    [],
  )

  const applyIncomingState = useCallback(
    (incoming: TableState) => {
      setLiveState((previous) => {
        const isSameHand = incoming.hand_id !== null && previous?.hand_id === incoming.hand_id
        const mergedHero = incoming.hero ?? (isSameHand ? previous?.hero ?? null : null)
        const mergedHandResult = incoming.hand_result ?? (isSameHand ? previous?.hand_result ?? null : null)
        const mergedReadyPlayers =
          incoming.ready_players ?? (isSameHand ? previous?.ready_players ?? [] : [])
        const mergedPlayers: TablePlayerState[] =
          incoming.players?.length
            ? incoming.players
            : previous?.players?.length
              ? previous.players
              : []
        const mergedBoard = incoming.board?.length
          ? incoming.board
          : isSameHand
            ? previous?.board ?? []
            : []
        const mergedPots = incoming.pots?.length
          ? incoming.pots
          : isSameHand
            ? previous?.pots ?? []
            : []
        const mergedCurrentActor =
          incoming.current_actor !== undefined
            ? incoming.current_actor
            : isSameHand
              ? previous?.current_actor ?? null
              : null
        const mergedCurrentActorUserId =
          incoming.current_actor_user_id !== undefined
            ? incoming.current_actor_user_id
            : isSameHand
              ? previous?.current_actor_user_id ?? mergedCurrentActor
              : mergedCurrentActor

        const nextState: TableState = {
          ...(previous ?? incoming),
          ...incoming,
          board: mergedBoard,
          pots: mergedPots,
          hero: mergedHero,
          hand_result: mergedHandResult,
          ready_players: mergedReadyPlayers,
          players: mergedPlayers,
          current_actor: mergedCurrentActor,
          current_actor_user_id: mergedCurrentActorUserId,
          allowed_actions: incoming.allowed_actions ?? (isSameHand ? previous?.allowed_actions : undefined),
        }

        syncHandResults(nextState.hand_id ?? null, mergedHandResult, isSameHand)
        return nextState
      })
    },
    [syncHandResults],
  )

  const fetchLiveState = useCallback(async () => {
    if (!tableId) {
      return
    }
    try {
      const data = await apiFetch<TableState>(`/tables/${tableId}/state`, {
        method: 'GET',
        initData: initDataRef.current ?? undefined,
      })
      applyIncomingState(data)
    } catch (err) {
      console.warn('Unable to fetch live state', err)
    }
  }, [applyIncomingState, tableId])

  const heroId = liveState?.hero?.user_id ?? null
  const heroIdString = heroId !== null ? heroId.toString() : null
  const heroPlayer = liveState?.players.find((p) => p.user_id?.toString() === heroIdString)
  const heroCards = liveState?.hero?.cards ?? []
  const currentActorUserId = liveState?.current_actor_user_id ?? liveState?.current_actor ?? null
  const currentPhase = useMemo(() => {
    if (liveState?.phase) return liveState.phase
    const normalizedStatus = liveState?.status?.toString().toLowerCase()
    if (normalizedStatus === 'inter_hand_wait') return 'inter_hand_wait'
    if (!normalizedStatus || normalizedStatus === 'waiting') return 'waiting'
    if (['ended', 'expired'].includes(normalizedStatus)) return 'finished'
    return 'playing'
  }, [liveState?.phase, liveState?.status])
  const isInterHand = currentPhase === 'inter_hand_wait'
  const isPlaying = currentPhase === 'playing'
  const readyPlayerIds = useMemo(
    () => (liveState?.ready_players ?? []).map((id) => id?.toString()),
    [liveState?.ready_players],
  )
  const normalizeAllowedActions = useCallback(
    (allowed: AllowedActionsPayload | undefined): AllowedAction[] => {
      const toNumber = (value?: number | string | null) =>
        value === undefined || value === null ? undefined : Number(value)

      if (!allowed) return []
      if (Array.isArray(allowed))
        return allowed.map((action) => ({
          ...action,
          amount: toNumber(action.amount),
          min_amount: toNumber(action.min_amount),
          max_amount: toNumber(action.max_amount),
        }))

      const actions: AllowedAction[] = []

      if (allowed.can_fold) {
        actions.push({ action_type: 'fold' })
      }
      if (allowed.can_check) {
        actions.push({ action_type: 'check' })
      }
      if (allowed.can_call) {
        actions.push({ action_type: 'call', amount: toNumber(allowed.call_amount) ?? 0 })
      }

      const minRaise = toNumber(allowed.min_raise_to) ?? 0
      const maxRaise =
        toNumber(allowed.max_raise_to) ?? (heroPlayer ? heroPlayer.stack + heroPlayer.bet : 0)

      if (allowed.can_bet) {
        actions.push({
          action_type: 'bet',
          min_amount: minRaise,
          max_amount: maxRaise,
        })
      }
      if (allowed.can_raise) {
        const isAllIn = allowed.can_all_in || (heroPlayer ? maxRaise >= heroPlayer.stack + heroPlayer.bet : false)
        actions.push({
          action_type: isAllIn ? 'all_in' : 'raise',
          min_amount: minRaise,
          max_amount: maxRaise,
        })
      } else if (allowed.can_all_in) {
        actions.push({ action_type: 'all_in', min_amount: maxRaise, max_amount: maxRaise })
      }

      if (allowed.ready) {
        actions.push({ action_type: 'ready' })
      }

      return actions
    },
    [heroPlayer],
  )

  const handleGameAction = useCallback(
    async (actionType: AllowedAction['action_type'], amount?: number) => {
      if (!tableId || !initData) {
        showToast(t('table.errors.unauthorized'))
        return
      }

      const isReadyAction = actionType === 'ready'
      const normalizedActions = normalizeAllowedActions(liveState?.allowed_actions)

      if (isReadyAction) {
        if (!isInterHand) {
          showToast(t('table.errors.actionNotAllowed', { defaultValue: 'Action not available' }))
          return
        }
        if (heroIdString && readyPlayerIds.includes(heroIdString)) {
          showToast(t('table.toast.ready', "You're joining the next hand"))
          return
        }
      }

      if (!isReadyAction) {
        if (!isPlaying) {
          showToast(t('table.errors.actionNotAllowed', { defaultValue: 'Action not available' }))
          return
        }
        if (!heroIdString || !currentActorUserId || currentActorUserId.toString() !== heroIdString) {
          showToast(t('table.errors.notYourTurn', { defaultValue: "It's not your turn" }))
          return
        }

        const isAllowed = normalizedActions.some((action) => action.action_type === actionType)
        if (!isAllowed) {
          showToast(t('table.errors.actionNotAllowed', { defaultValue: 'Action not available' }))
          return
        }
      }

      try {
        setActionPending(true)
        const state = await apiFetch<TableState | { ready_players?: Array<number | string> }>(
          `/tables/${tableId}/actions`,
          {
            method: 'POST',
            initData,
            body: {
              action_type: actionType,
              amount,
            },
          },
        )

        if (state && (state as TableState).type === 'table_state') {
          applyIncomingState(state as TableState)
        } else if ('ready_players' in state) {
          setLiveState((previous) =>
            previous ? { ...previous, ready_players: state.ready_players ?? [] } : previous,
          )
        }

        if (!isReadyAction) {
          fetchLiveState()
        } else {
          showToast(t('table.toast.ready', "You're joining the next hand"))
        }
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
    },
    [
      applyIncomingState,
      fetchLiveState,
      heroIdString,
      currentActorUserId,
      initData,
      isInterHand,
      isPlaying,
      liveState?.allowed_actions,
      normalizeAllowedActions,
      readyPlayerIds,
      showToast,
      t,
      tableId,
    ],
  )

  // Helper to get center position of an element
  const getElementCenter = useCallback((element: HTMLElement | null): { x: number; y: number } | null => {
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }, [])

  // Remove completed animations
  const handleAnimationComplete = useCallback((id: string) => {
    setChipAnimations((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // Trigger chip animation on last_action changes
  useEffect(() => {
    if (!liveState?.last_action) return
    
    const lastAction = liveState.last_action
    
    // Check if this is a new action
    if (
      lastActionRef.current?.user_id === lastAction.user_id &&
      lastActionRef.current?.action === lastAction.action &&
      lastActionRef.current?.amount === lastAction.amount &&
      lastActionRef.current?.created_at === lastAction.created_at
    ) {
      return
    }
    
    lastActionRef.current = lastAction
    
    // Only animate for bet/raise/call/all_in actions with amount > 0
    const shouldAnimate =
      ['bet', 'raise', 'call', 'all_in'].includes(lastAction.action) &&
      (lastAction.amount ?? 0) > 0
    
    if (!shouldAnimate) return
    
    // Get player tile position
    const playerKey = lastAction.user_id.toString()
    const playerTile = playerTileRefs.current.get(playerKey)
    const playerPos = getElementCenter(playerTile ?? null)
    const potPos = getElementCenter(potAreaRef.current)
    
    if (!playerPos || !potPos) return
    
    // Create animation
    const animationId = `action-${lastAction.user_id}-${Date.now()}`
    const newAnimation: ChipAnimation = {
      id: animationId,
      fromX: playerPos.x,
      fromY: playerPos.y,
      toX: potPos.x,
      toY: potPos.y,
    }
    
    setChipAnimations((prev) => [...prev, newAnimation])
  }, [liveState?.last_action, getElementCenter])

  // Trigger pot-to-winner animation on hand_result
  useEffect(() => {
    if (!liveState?.hand_result?.winners?.length) return
    
    // Check if this is a new hand result
    const currentResult = liveState.hand_result
    if (lastHandResultRef.current === currentResult) return
    
    lastHandResultRef.current = currentResult
    
    const potPos = getElementCenter(potAreaRef.current)
    if (!potPos) return
    
    // Animate to main winner (first winner with highest amount)
    const mainWinner = currentResult.winners.reduce((max, winner) =>
      winner.amount > max.amount ? winner : max
    , currentResult.winners[0])
    
    const winnerKey = mainWinner.user_id.toString()
    const winnerTile = playerTileRefs.current.get(winnerKey)
    const winnerPos = getElementCenter(winnerTile ?? null)
    
    if (!winnerPos) return
    
    // Create animation from pot to winner
    const animationId = `pot-win-${mainWinner.user_id}-${Date.now()}`
    const newAnimation: ChipAnimation = {
      id: animationId,
      fromX: potPos.x,
      fromY: potPos.y,
      toX: winnerPos.x,
      toY: winnerPos.y,
    }
    
    setChipAnimations((prev) => [...prev, newAnimation])
  }, [liveState?.hand_result, getElementCenter])

  // Auto-refresh balance and stats when a hand completes
  // Also show the ready modal when entering inter-hand wait phase
  useEffect(() => {
    // Show modal when entering inter-hand wait phase
    if (liveState?.inter_hand_wait && liveState?.hand_result?.winners?.length) {
      if (lastCompletedHandIdRef.current !== liveState.hand_id) {
        lastCompletedHandIdRef.current = liveState.hand_id
        
        // Refetch balance and stats
        refetchUserData().catch((err) => {
          console.warn('Failed to refetch user data after hand completion', err)
        })
        
      }
    }
  }, [liveState?.inter_hand_wait, liveState?.hand_result, liveState?.hand_id, refetchUserData, tableDetails?.status, tableDetails?.is_expired])

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

  // Handle player signaling ready for next hand
  const handleReady = useCallback(async () => {
    await handleGameAction('ready')
  }, [handleGameAction])

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
  const { waitForConnection } = useTableWebSocket({
    tableId: tableId || '',
    enabled: !!tableId,
    onMessage: useCallback(
      (payload: any) => {
        // Log all incoming WebSocket messages for diagnostics
        console.log('[Table WebSocket] Message received:', {
          type: payload?.type,
          table_id: payload?.table_id,
          current_actor: payload?.current_actor,
          status: payload?.status,
          inter_hand_wait: payload?.inter_hand_wait,
          ready_players: payload?.ready_players,
          ...(payload?.type === 'hand_ended' || payload?.type === 'table_ended'
            ? { payload }
            : {}),
        })

        if (payload?.type === 'table_state') {
          applyIncomingState(payload as TableState)
          return
        }

        if (payload?.type === 'player_ready') {
          setLiveState((previous) => {
            if (!previous) return previous
            const updated = new Set((previous.ready_players ?? []).map((id) => id?.toString()))
            if (payload.user_id !== undefined && payload.user_id !== null) {
              updated.add(payload.user_id.toString())
            }
            if (Array.isArray(payload.ready_players)) {
              payload.ready_players.forEach((id: number | string) => updated.add(id.toString()))
            }
            return { ...previous, ready_players: Array.from(updated) }
          })
          return
        }

        if (payload?.type === 'hand_ended') {
          const endedHandNo = payload.hand_id ?? payload.hand_no ?? null
          if (endedHandNo && liveState?.hand_id && liveState.hand_id > endedHandNo) {
            // Skip stale hand_ended events once a newer hand is active
            return
          }
          const winners = (payload.hand_result?.winners ?? payload.winners ?? []) as HandResultPayload['winners']
          const showdownHands =
            payload.hand_result?.showdown_hands ??
            payload.showdown_hands ??
            payload.hands ??
            payload.players ??
            []

          const handResult: HandResultPayload | null = winners?.length
            ? {
                winners,
                showdown_hands: showdownHands,
                rake_amount: payload.hand_result?.rake_amount,
                total_pot: payload.hand_result?.total_pot ?? payload.total_pot ?? payload.pot_total,
              }
            : null

          const interHandState: TableState = {
            type: 'table_state',
            table_id: payload.table_id ?? Number(tableId ?? 0),
            hand_id: endedHandNo ?? liveState?.hand_id ?? null,
            status: 'INTER_HAND_WAIT',
            phase: 'inter_hand_wait',
            street: 'showdown',
            board: payload.board ?? liveState?.board ?? [],
            pot: payload.total_pot ?? payload.pot_total ?? liveState?.pot ?? 0,
            pots: payload.pots ?? liveState?.pots ?? [],
            current_bet: 0,
            min_raise: liveState?.min_raise ?? 0,
            current_actor: null,
            current_actor_user_id: null,
            action_deadline: null,
            turn_timeout_seconds: payload.turn_timeout_seconds ?? liveState?.turn_timeout_seconds,
            players: payload.players ?? liveState?.players ?? [],
            hero: liveState?.hero ?? null,
            last_action: null,
            hand_result: handResult,
            inter_hand_wait: true,
            inter_hand_wait_seconds:
              payload.next_hand_in ?? payload.inter_hand_wait_seconds ?? liveState?.inter_hand_wait_seconds ?? 20,
            inter_hand_wait_deadline: payload.inter_hand_wait_deadline ?? payload.deadline ?? null,
            inter_hand: {
              hand_no: endedHandNo ?? null,
              ready_count: payload.ready_players?.length ?? 0,
              min_players: payload.min_players ?? 2,
              ready_players: payload.ready_players ?? [],
              players: (payload.players ?? liveState?.players ?? []).map((player: TablePlayerState) => ({
                user_id: player.user_id,
                is_ready: payload.ready_players?.includes(player.user_id as never) ?? false,
                is_sitting_out_next_hand: player.is_sitting_out_next_hand,
                display_name: (player as any).display_name ?? (player as any).username ?? null,
              })),
            },
            allowed_actions:
              payload.allowed_actions ?? (Array.isArray(payload.allowed_actions) ? payload.allowed_actions : { ready: true }),
            ready_players: payload.ready_players ?? [],
          }

          applyIncomingState(interHandState)
          if (handResult) {
            setLastHandResult(handResult)
          }
          fetchLiveState()
          return
        }

        if (payload?.type === 'table_ended') {
          setTableExpiredReason(payload.reason || t('table.messages.notEnoughPlayers', 'Not enough players'))
          setShowTableExpiredModal(true)
          return
        }

        if (
          payload?.type === 'action' ||
          payload?.type === 'table_started' ||
          payload?.type === 'player_joined' ||
          payload?.type === 'player_left'
        ) {
          fetchTable()
        }
      },
      [applyIncomingState, fetchLiveState, fetchTable, liveState?.board, liveState?.hand_id, liveState?.hero, liveState?.inter_hand_wait_seconds, liveState?.min_raise, liveState?.players, liveState?.pot, liveState?.pots, liveState?.turn_timeout_seconds, tableId, t],
    ),
    onStateChange: useCallback(
      (payload: TableState) => {
        if (payload.status === 'expired' || payload.table_status === 'expired') {
          showToast(t('table.expiration.expired', { defaultValue: 'Table has expired' }))
          setTimeout(() => navigate('/lobby', { replace: true }), EXPIRED_TABLE_REDIRECT_DELAY_MS)
          return
        }

        const isNewHand = payload.hand_id !== null && lastHandIdRef.current !== payload.hand_id
        applyIncomingState(payload)

        if (isNewHand && payload.hand_id !== null) {
          lastHandIdRef.current = payload.hand_id
          fetchLiveState()
        }
      },
      [applyIncomingState, fetchLiveState, navigate, showToast, t],
    ),
    onConnect: useCallback(() => {
      console.log('[Table WebSocket] Connected to table', tableId)
      // Refresh viewer-specific state (including hero cards) after reconnects
      fetchLiveState()
    }, [fetchLiveState, tableId]),
    onDisconnect: useCallback(() => {
      console.log('[Table WebSocket] Disconnected from table', tableId)
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
      
      // CRITICAL FIX: Wait for WebSocket to be connected BEFORE sitting
      // This ensures the player's WebSocket will receive the broadcast
      // when the server sends the updated table state after sitting
      console.log('[Table] Waiting for WebSocket connection before sitting...')
      const connected = await waitForConnection(5000)
      
      if (!connected) {
        console.warn('[Table] WebSocket not connected, proceeding anyway...')
        // Still proceed - the state will be fetched via REST
      } else {
        console.log('[Table] WebSocket connected, proceeding to sit')
      }
      
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

  const allowedActions = normalizeAllowedActions(liveState?.allowed_actions)
  const callAction = allowedActions.find((action) => action.action_type === 'call')
  const canCheckAction = allowedActions.some((action) => action.action_type === 'check')
  const canCheck = canCheckAction || (callAction?.amount ?? 0) === 0
  const tableStatus = (liveState?.status ?? tableDetails?.status ?? '').toString().toLowerCase()
  const normalizedStatus = tableStatus
  const potDisplayAmount = useMemo(() => {
    if (typeof liveState?.pot === 'number') return liveState.pot
    if (liveState?.pots?.length) {
      return liveState.pots.reduce((sum, pot) => sum + (pot.amount ?? 0), 0)
    }
    return 0
  }, [liveState?.pot, liveState?.pots])
  const winningBoardCards = useMemo(
    () =>
      liveState?.hand_result?.winners?.flatMap((winner) => winner.best_hand_cards ?? []) ?? [],
    [liveState?.hand_result?.winners],
  )
  const showdownCardsByPlayer = useMemo(() => {
    const lookup = new Map<string, string[]>()
    if (heroIdString && heroCards.length) {
      lookup.set(heroIdString, heroCards)
    }

    const canReveal = isInterHand || normalizedStatus === 'showdown'

    if (canReveal && liveState?.players) {
      liveState.players.forEach((player) => {
        const candidateCards =
          (player as any).cards || (player as any).hole_cards || player.cards || player.hole_cards
        if (Array.isArray(candidateCards) && candidateCards.length) {
          lookup.set(player.user_id.toString(), candidateCards as string[])
        }
      })

      const resultHands = liveState.hand_result
      const showdownCollections = [resultHands?.showdown_hands, resultHands?.hands, resultHands?.players]
      showdownCollections.forEach((collection) => {
        collection?.forEach((hand) => {
          if (hand?.user_id !== undefined && Array.isArray(hand.cards)) {
            lookup.set(hand.user_id.toString(), hand.cards)
          }
        })
      })

      resultHands?.winners?.forEach((winner) => {
        if (winner.cards?.length) {
          lookup.set(winner.user_id.toString(), winner.cards)
        }
      })
    }

    return lookup
  }, [heroCards, heroIdString, isInterHand, liveState?.hand_result, liveState?.players, normalizedStatus])

  // Log inter-hand state only when isInterHand actually changes (not on every render)
  useEffect(() => {
    // Only log when isInterHand changes from previous value
    if (prevIsInterHandRef.current !== isInterHand) {
      console.log('[Table] Inter-hand state changed:', {
        isInterHand,
        previous: prevIsInterHandRef.current,
        normalizedStatus,
        liveState_inter_hand_wait: liveState?.inter_hand_wait,
        liveState_status: liveState?.status,
        has_hand_result: lastHandResult !== null,
        ready_players: liveState?.ready_players,
        heroId,
      })
      prevIsInterHandRef.current = isInterHand
    }
  }, [isInterHand, normalizedStatus, liveState?.inter_hand_wait, liveState?.status, lastHandResult, liveState?.ready_players, heroId])
  
  const isMyTurn =
    isPlaying && heroIdString !== null && currentActorUserId?.toString() === heroIdString
  const actionableAllowedActions = isMyTurn ? allowedActions : []

  useEffect(() => {
    if (liveState?.hand_id !== autoTimeoutRef.current.handId) {
      autoTimeoutRef.current = { handId: liveState?.hand_id ?? null, count: 0 }
    }
  }, [liveState?.hand_id])

  useEffect(() => {
    if (autoActionTimerRef.current) {
      clearTimeout(autoActionTimerRef.current)
      autoActionTimerRef.current = null
    }

    if (
      !isPlaying ||
      !liveState ||
      !heroIdString ||
      currentActorUserId?.toString() !== heroIdString ||
      !liveState.action_deadline
    ) {
      return undefined
    }

    const deadlineMs = new Date(liveState.action_deadline).getTime()
    const delay = Math.max(0, deadlineMs - Date.now())

    const handleAutoAction = () => {
      const timeoutCount =
        autoTimeoutRef.current.handId === liveState.hand_id ? autoTimeoutRef.current.count : 0

      if (timeoutCount === 0 && canCheck) {
        handleGameAction('check')
      } else {
        handleGameAction('fold')
      }

      autoTimeoutRef.current = {
        handId: liveState.hand_id ?? null,
        count: timeoutCount + 1,
      }
    }

    autoActionTimerRef.current = window.setTimeout(handleAutoAction, delay)

    return () => {
      if (autoActionTimerRef.current) {
        clearTimeout(autoActionTimerRef.current)
        autoActionTimerRef.current = null
      }
    }
  }, [
    canCheck,
    handleGameAction,
    heroIdString,
    isPlaying,
    liveState?.action_deadline,
    currentActorUserId,
    liveState?.hand_id,
  ])

  // Control bottom navigation visibility based on seated status
  useEffect(() => {
    // Hide bottom nav when seated and playing, show it when spectating
    const viewerIsSeated = tableDetails?.viewer?.is_seated ?? false
    setShowBottomNav(!viewerIsSeated)
    // Restore bottom nav on unmount
    return () => {
      setShowBottomNav(true)
    }
  }, [tableDetails?.viewer?.is_seated, setShowBottomNav])

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

  const viewerIsCreator = tableDetails.viewer?.is_creator ?? false
  const viewerIsSeated = tableDetails.viewer?.is_seated ?? false
  
  // Derive canStart from liveState for real-time responsiveness (per spec: must depend on WS liveState)
  const livePlayerCount = liveState?.players?.length ?? tableDetails.player_count
  const hasActiveHand = liveState?.hand_id !== null && liveState?.status !== 'waiting'
  const canStart = viewerIsCreator && 
                   livePlayerCount >= 2 && 
                   (tableDetails.status === 'waiting' || 
                    (tableDetails.status === 'active' && !hasActiveHand))
  
  const canJoin = tableDetails.permissions?.can_join ?? false
  const canLeave = tableDetails.permissions?.can_leave ?? false
  const missingPlayers = Math.max(0, 2 - livePlayerCount)
  const players = (tableDetails.players || []).slice().sort((a, b) => a.position - b.position)

  return (
    <PokerFeltBackground>
      <Toast message={toast.message} visible={toast.visible} />
      
      {/* Chip Animations */}
      <ChipFlyManager animations={chipAnimations} onAnimationComplete={handleAnimationComplete} />
      
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
      
        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-3 pb-12 pt-4 sm:px-6">
          {liveState ? (
            <TableLayoutV2
              infoPill={(
                <TableInfoPill
                  tableName={tableDetails.table_name}
                  tableId={tableDetails.table_id}
                  smallBlind={tableDetails.small_blind}
                  bigBlind={tableDetails.big_blind}
                  playerCount={liveState.players.length}
                  maxPlayers={tableDetails.max_players}
                  mode={tableDetails.visibility}
                  onLeave={canLeave ? handleLeave : undefined}
                  canLeave={canLeave}
                />
              )}
              board={(
                <div className="flex flex-col items-center gap-2">
                  <BoardAndPot
                    ref={potAreaRef}
                    cards={liveState.board ?? []}
                    potAmount={potDisplayAmount}
                    winningCards={winningBoardCards}
                  />
                  {liveState.hand_result && <HandResultPanel liveState={liveState} currentUserId={heroId} />}
                </div>
              )}
              players={(
                <PlayerRing
                  players={liveState.players
                    .filter((p) => p.user_id !== heroId)
                    .map((player, index) => {
                      const isActor = player.user_id?.toString() === currentActorUserId?.toString()
                      const isLastActor = liveState.last_action?.user_id?.toString() === player.user_id?.toString()
                      const lastActionText = (() => {
                        if (!isLastActor || !liveState.last_action) return null
                        const action = liveState.last_action.action
                        const amount = liveState.last_action.amount

                        if (action === 'fold') return t('table.actions.lastAction.fold')
                        if (action === 'check') return t('table.actions.lastAction.check')
                        if (action === 'call' && amount) return t('table.actions.lastAction.call', { amount })
                        if (action === 'bet' && amount) return t('table.actions.lastAction.bet', { amount })
                        if (action === 'raise' && amount) return t('table.actions.lastAction.raise', { amount })
                        if (action === 'all_in' && amount) return t('table.actions.lastAction.all_in', { amount })
                        return null
                      })()

                      const positionLabel = player.is_button
                        ? 'BTN'
                        : player.is_small_blind
                          ? 'SB'
                          : player.is_big_blind
                            ? 'BB'
                            : undefined

                      const playerCards = showdownCardsByPlayer.get(player.user_id.toString()) ?? []
                      const winningHand = liveState.hand_result?.winners?.find(
                        (winner) => winner.user_id?.toString() === player.user_id.toString(),
                      )

                      const playerStatus = player.is_sitting_out_next_hand
                        ? 'sit_out'
                        : !player.in_hand && liveState.hand_id
                          ? 'folded'
                          : liveState.hand_id
                            ? 'active'
                            : 'waiting'

                      return {
                        id: `villain-${player.user_id}-${index}`,
                        node: (
                          <div
                            ref={(el) => {
                              const playerKey = player.user_id.toString()
                              if (el) {
                                playerTileRefs.current.set(playerKey, el)
                              } else {
                                playerTileRefs.current.delete(playerKey)
                              }
                            }}
                            className="flex flex-col items-center gap-1"
                          >
                            <PlayerAvatar
                              name={player.display_name || player.username || `P${(player.seat ?? player.position ?? 0) + 1}`}
                              stack={player.stack}
                              isActive={Boolean(isActor && player.in_hand)}
                              hasFolded={!player.in_hand}
                              betAmount={player.bet}
                              deadline={isActor ? liveState.action_deadline : null}
                              turnTimeoutSeconds={liveState.turn_timeout_seconds || DEFAULT_TURN_TIMEOUT_SECONDS}
                              size={liveState.players.length >= 6 ? 'sm' : 'md'}
                              offsetTop
                              seatNumber={player.seat ?? player.position}
                              positionLabel={positionLabel}
                              lastAction={lastActionText}
                              isSittingOut={player.is_sitting_out_next_hand}
                              status={playerStatus}
                              isAllIn={Boolean(player.is_all_in || player.stack <= 0)}
                            />
                            {lastActionText && player.in_hand && (
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200">{lastActionText}</p>
                            )}
                            {playerCards.length > 0 && (isInterHand || normalizedStatus === 'showdown') && (
                              <div className="mt-1 flex gap-1">
                                {playerCards.map((card, idx) => {
                                  const isWinningCard = winningHand?.best_hand_cards?.includes(card) ?? false
                                  return (
                                    <PlayingCard
                                      key={`villain-card-${player.user_id}-${card}-${idx}`}
                                    card={card}
                                    size="sm"
                                    highlighted={isWinningCard}
                                    />
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ),
                      }
                    })}
                />
              )}
              hero={heroPlayer && (
                <div
                  ref={(el) => {
                    if (el && heroId) {
                      playerTileRefs.current.set(heroId.toString(), el)
                    } else if (heroId) {
                      playerTileRefs.current.delete(heroId.toString())
                    }
                  }}
                  className="flex flex-col items-center gap-2"
                >
                  {heroCards.length > 0 && liveState.hand_id && liveState.status !== 'ended' && liveState.status !== 'waiting' && (
                    <div className="flex gap-2.5">
                      {heroCards.map((card, idx) => {
                        const heroWinner = liveState.hand_result?.winners?.find((w) => w.user_id?.toString() === heroIdString)
                        const isWinningCard = heroWinner?.best_hand_cards?.includes(card) ?? false
                        return (
                          <div
                            key={`hero-card-${idx}`}
                            className="transition-transform"
                            style={{ transform: idx === 0 ? 'rotate(-4deg)' : 'rotate(4deg)' }}
                          >
                            <PlayingCard card={card} size="md" highlighted={isWinningCard} />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <PlayerAvatar
                    name={heroPlayer.display_name || t('table.players.youTag')}
                    stack={heroPlayer.stack}
                    isHero
                    isActive={Boolean(heroPlayer.in_hand && heroPlayer.user_id?.toString() === currentActorUserId?.toString())}
                    hasFolded={!heroPlayer.in_hand}
                    betAmount={heroPlayer.bet}
                    deadline={heroPlayer.user_id?.toString() === currentActorUserId?.toString() ? liveState.action_deadline : null}
                    turnTimeoutSeconds={liveState.turn_timeout_seconds || DEFAULT_TURN_TIMEOUT_SECONDS}
                    size="md"
                    seatNumber={heroPlayer.seat ?? heroPlayer.position}
                    positionLabel={heroPlayer.is_button ? 'BTN' : heroPlayer.is_small_blind ? 'SB' : heroPlayer.is_big_blind ? 'BB' : undefined}
                    isSittingOut={heroPlayer.is_sitting_out_next_hand}
                    status={heroPlayer.is_sitting_out_next_hand ? 'sit_out' : !heroPlayer.in_hand && liveState.hand_id ? 'folded' : liveState.hand_id ? 'active' : 'waiting'}
                    isAllIn={Boolean(heroPlayer.is_all_in || heroPlayer.stack <= 0)}
                  />
                </div>
              )}
              action={viewerIsSeated && (
                <ActionSurface
                  allowedActions={actionableAllowedActions}
                  isMyTurn={isMyTurn}
                  onAction={handleGameAction}
                  potSize={potDisplayAmount}
                  myStack={heroPlayer?.stack ?? 0}
                  isProcessing={actionPending || loading}
                  isInterHand={isInterHand}
                  readyPlayerIds={readyPlayerIds}
                  players={liveState.players}
                  deadline={liveState.inter_hand_wait_deadline}
                  interHandSeconds={liveState.inter_hand_wait_seconds}
                  onReady={handleReady}
                  heroId={heroIdString}
                />
              )}
              overlays={isInterHand ? (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                  <div className="pointer-events-auto">
                    <WinnerShowcase handResult={lastHandResult} players={liveState.players} />
                  </div>
                </div>
              ) : null}
            />
          ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md px-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
              <h2 className="mb-6 text-2xl font-bold text-white">
                {tableDetails.status === 'waiting' ? t('table.status.waiting') : t('table.status.loading')}
              </h2>

              <div className="mb-8">
                <p className="mb-4 text-sm text-white/70">
                  {t('table.meta.players')}: {tableDetails.player_count} / {tableDetails.max_players}
                </p>
                <div className="space-y-2.5">
                  {players.map((player) => (
                    <div
                      key={`waiting-${player.user_id}-${player.position}`}
                      className="flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md transition-all hover:bg-white/15"
                    >
                      <span className="text-sm font-medium text-white">
                        {player.display_name || player.username || `Player ${player.position + 1}`}
                      </span>
                      <div className="flex gap-2">
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
                  ))}
                </div>
              </div>

              {viewerIsSeated ? (
                <div className="space-y-4">
                  <p className="text-sm text-white/60">
                    {viewerIsCreator
                      ? canStart
                        ? t('table.messages.readyToStart')
                        : t('table.messages.waitForPlayers', { count: missingPlayers })
                      : t('table.messages.waitingForHost')}
                  </p>
                  {canLeave && (
                    <Button
                      variant="secondary"
                      size="md"
                      block
                      onClick={handleLeave}
                      disabled={isLeaving}
                    >
                      {isLeaving ? t('table.actions.leaving') : t('table.actions.leave')}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-white/60">
                    {canJoin ? t('table.messages.joinPrompt') : t('table.messages.tableFull')}
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    block
                    onClick={handleSeat}
                    disabled={!canJoin || isSeating}
                  >
                    {isSeating ? t('table.actions.joining') : t('table.actions.takeSeat')}
                  </Button>
                </div>
              )}

              {viewerIsCreator && (
                <div className="mt-8 border-t border-white/20 pt-6">
                  <Button
                    variant="danger"
                    size="sm"
                    block
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting}
                  >
                    {t('table.actions.delete')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RecentHandsModal
        isOpen={showRecentHands}
        onClose={() => setShowRecentHands(false)}
        tableId={parseInt(tableId || '0', 10)}
        initData={initData ?? undefined}
      />

      <TableExpiredModal
        isOpen={showTableExpiredModal}
        reason={tableExpiredReason}
        onClose={() => {
          setShowTableExpiredModal(false)
          navigate('/lobby')
        }}
      />
    </div>
  </PokerFeltBackground>
  )
}
