import { useCallback, useEffect, useState, useRef } from 'react'
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
import InterHandVoting from '../components/tables/InterHandVoting'
import WinnerShowcase from '../components/tables/WinnerShowcase'
import ActionDock, { type AllowedAction } from '@/components/game/ActionDock'
import PokerFeltBackground from '../components/background/PokerFeltBackground'
import SmartTableHeader from '../components/tables/SmartTableHeader'
import PlayerAvatar from '../components/tables/PlayerAvatar'

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
  position?: number | null
  stack: number
  bet: number
  in_hand: boolean
  is_button: boolean
  is_small_blind: boolean
  is_big_blind: boolean
  acted?: boolean
  display_name?: string | null
  username?: string | null
  is_sitting_out_next_hand?: boolean
}

interface LiveHeroState {
  user_id: number
  cards: string[]
}

interface HandWinnerResult {
  user_id: number
  amount: number
  pot_index: number
  hand_score: number
  hand_rank: string
  best_hand_cards: string[]
}

interface LastAction extends Record<string, unknown> {
  user_id: number
  action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | string
  amount?: number | null
  street?: string | null
  created_at?: string | null
}

type AllowedActionsPayload =
  | AllowedAction[]
  | {
      can_fold?: boolean
      can_check?: boolean
      can_call?: boolean
      call_amount?: number
      can_bet?: boolean
      can_raise?: boolean
      min_raise_to?: number
      max_raise_to?: number
    }

interface LiveTableState {
  type: 'table_state'
  table_id: number
  hand_id: number | null
  status: string
  table_status?: string
  street: string | null
  board: string[]
  pot: number
  pots?: Array<{
    pot_index: number
    amount: number
    eligible_user_ids: number[]
  }>
  current_bet: number
  min_raise: number
  current_actor: number | null
  action_deadline?: string | null
  turn_timeout_seconds?: number
  players: LivePlayerState[]
  hero: LiveHeroState | null
  last_action?: LastAction | null
  hand_result?: { winners: HandWinnerResult[] } | null
  inter_hand_wait?: boolean
  inter_hand_wait_seconds?: number
  inter_hand_wait_deadline?: string | null
  allowed_actions?: AllowedActionsPayload
  ready_players?: number[]
}

const DEFAULT_TOAST = { message: '', visible: false }
const EXPIRED_TABLE_REDIRECT_DELAY_MS = 2000
const DEFAULT_TURN_TIMEOUT_SECONDS = 25
/**
 * Street names that indicate active gameplay.
 * During gameplay, liveState.status contains the current street name (preflop, flop, turn, river)
 * rather than 'active'. Action buttons should be shown when tableStatus is one of these values.
 */
const ACTIVE_GAMEPLAY_STREETS = ['preflop', 'flop', 'turn', 'river']
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
  const [isStarting, setIsStarting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toast, setToast] = useState(DEFAULT_TOAST)
  const [liveState, setLiveState] = useState<LiveTableState | null>(null)
  const [lastHandResult, setLastHandResult] =
    useState<LiveTableState['hand_result'] | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [chipAnimations, setChipAnimations] = useState<ChipAnimation[]>([])
  const [showRecentHands, setShowRecentHands] = useState(false)

  const [showTableExpiredModal, setShowTableExpiredModal] = useState(false)
  const [tableExpiredReason, setTableExpiredReason] = useState('')

  const autoTimeoutRef = useRef<{ handId: number | null; count: number }>({ handId: null, count: 0 })
  const autoActionTimerRef = useRef<number | null>(null)
  
  // Refs for tracking elements for animations
  const playerTileRefs = useRef<Map<number, HTMLElement>>(new Map())
  const potAreaRef = useRef<HTMLDivElement | null>(null)
  const lastActionRef = useRef<LastAction | null>(null)
  const lastHandResultRef = useRef<LiveTableState['hand_result'] | null>(null)
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
      incomingResult: LiveTableState['hand_result'] | null,
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

  const fetchLiveState = useCallback(async () => {
    if (!tableId) {
      return
    }
    try {
      const data = await apiFetch<LiveTableState>(`/tables/${tableId}/state`, {
        method: 'GET',
        initData: initDataRef.current ?? undefined,
      })
      setLiveState((previous) => {
        const isSameHand = data.hand_id !== null && previous?.hand_id === data.hand_id
        const mergedHero = data.hero ?? (isSameHand ? previous?.hero ?? null : null)
        const mergedHandResult = data.hand_result ?? (isSameHand ? previous?.hand_result ?? null : null)
        const mergedReadyPlayers =
          data.ready_players ?? (isSameHand ? previous?.ready_players ?? [] : [])
        const nextState: LiveTableState = {
          ...data,
          hero: mergedHero,
          hand_result: mergedHandResult,
          ready_players: mergedReadyPlayers,
        }
        syncHandResults(data.hand_id ?? null, mergedHandResult, isSameHand)
        return nextState
      })
    } catch (err) {
      console.warn('Unable to fetch live state', err)
    }
  }, [syncHandResults, tableId])

  const handleGameAction = useCallback(
    async (actionType: AllowedAction['action_type'], amount?: number) => {
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
        syncHandResults(state.hand_id ?? null, state.hand_result ?? null)
        fetchLiveState()
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
    [fetchLiveState, initData, showToast, syncHandResults, t, tableId],
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
    const playerTile = playerTileRefs.current.get(lastAction.user_id)
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
    
    const winnerTile = playerTileRefs.current.get(mainWinner.user_id)
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
    if (!tableId || !initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }

    try {
      const response = await apiFetch<any>(`/tables/${tableId}/ready`, {
        method: 'POST',
        initData,
      })

      if (response?.table_ended) {
        setTableExpiredReason(response.reason || t('table.messages.notEnoughPlayers', 'Not enough players'))
        setShowTableExpiredModal(true)
        return
      }

      if (response && response.type === 'table_state') {
        setLiveState((previous) => {
          const mergedHero = response.hero ?? previous?.hero ?? null
          const mergedHandResult = response.hand_result ?? previous?.hand_result ?? null
          const handId = response.hand_id ?? previous?.hand_id ?? null
          syncHandResults(handId, mergedHandResult, true)
          return { ...response, hero: mergedHero, hand_result: mergedHandResult }
        })
      } else if (response?.ready_players) {
        setLiveState((previous) =>
          previous
            ? { ...previous, ready_players: response.ready_players as number[] }
            : previous,
        )
      }

      await fetchLiveState()

      showToast(t('table.toast.ready', "You're joining the next hand"))
    } catch (err) {
      console.error('Error signaling ready:', err)
      if (err instanceof ApiError) {
        const message =
          (typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : null) || t('table.errors.actionFailed')
        showToast(message)
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    }
  }, [fetchLiveState, initData, showToast, syncHandResults, t, tableId])

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
    onMessage: useCallback((payload: any) => {
      // Log all incoming WebSocket messages for diagnostics
      console.log('[Table WebSocket] Message received:', {
        type: payload?.type,
        table_id: payload?.table_id,
        current_actor: payload?.current_actor,
        status: payload?.status,
        inter_hand_wait: payload?.inter_hand_wait,
        ready_players: payload?.ready_players,
        // Only log full payload for specific message types
        ...(payload?.type === 'hand_ended' || payload?.type === 'table_ended' ? { payload } : {}),
      })

      // Handle different message types
      if (payload?.type === 'player_ready') {
        console.log('[Table WebSocket] Player ready event:', {
          user_id: payload.user_id,
          ready_players: payload.ready_players,
        })
        setLiveState((previous) => {
          if (!previous) return previous
          const updated = new Set(previous.ready_players ?? [])
          if (payload.user_id) {
            updated.add(payload.user_id)
          }
          if (Array.isArray(payload.ready_players)) {
            payload.ready_players.forEach((id: number) => updated.add(id))
          }
          return { ...previous, ready_players: Array.from(updated) }
        })
        return
      }

      if (payload?.type === 'hand_ended') {
        console.log('[Table WebSocket] Hand ended event received:', {
          winners: payload.winners,
          pot_total: payload.pot_total,
          total_pot: payload.total_pot,
          next_hand_in: payload.next_hand_in,
          inter_hand_wait_deadline: payload.inter_hand_wait_deadline,
          status: payload.status,
        })
        // Update state to show inter-hand phase with winner information
        const winners = payload.winners && payload.winners.length > 0 ? payload.winners : null
        setLiveState((previous) => {
          if (!previous) return previous
          return {
            ...previous,
            status: 'INTER_HAND_WAIT',
            inter_hand_wait: true,
            inter_hand_wait_seconds: payload.next_hand_in ?? 20,
            inter_hand_wait_deadline: payload.inter_hand_wait_deadline ?? null,
            hand_result: winners ? { winners } : previous.hand_result,
            ready_players: [], // Reset ready players on hand_ended
          }
        })
        // Update lastHandResult for the winner showcase
        if (winners) {
          setLastHandResult({ winners })
        }
        return
      }

      if (payload?.type === 'table_ended') {
        console.log('[Table WebSocket] Table ended event:', {
          reason: payload.reason,
        })
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
        console.log('[Table WebSocket] Game state change event:', {
          type: payload?.type,
        })
        // Refetch table details on player/game state changes
        fetchTable()
      }
    }, [fetchTable, t]),
    onStateChange: useCallback((payload: LiveTableState) => {
      // Log state changes for diagnostics
      console.log('[Table WebSocket] State change:', {
        type: payload.type,
        status: payload.status,
        table_status: payload.table_status,
        current_actor: payload.current_actor,
        allowed_actions: payload.allowed_actions,
        hand_id: payload.hand_id,
        inter_hand_wait: payload.inter_hand_wait,
        ready_players: payload.ready_players,
      })

      // Check if table has expired
      if (payload.status === 'expired' || payload.table_status === 'expired') {
        console.log('[Table WebSocket] Table expired, redirecting to lobby')
        showToast(t('table.expiration.expired', { defaultValue: 'Table has expired' }))
        setTimeout(() => navigate('/lobby', { replace: true }), EXPIRED_TABLE_REDIRECT_DELAY_MS)
        return
      }

      const isNewHand =
        payload.hand_id !== null && lastHandIdRef.current !== payload.hand_id

      if (isNewHand) {
        console.log('[Table WebSocket] New hand detected:', {
          new_hand_id: payload.hand_id,
          previous_hand_id: lastHandIdRef.current,
        })
      }

      setLiveState((previous) => {
        const isSameHand =
          payload.hand_id !== null && previous?.hand_id === payload.hand_id
        const isInterHandPhase = payload.inter_hand_wait || payload.status === 'INTER_HAND_WAIT'
        const wasInterHandPhase = previous?.inter_hand_wait || previous?.status === 'INTER_HAND_WAIT'

        // Log inter-hand transitions
        if (isInterHandPhase && !wasInterHandPhase) {
          console.log('[Table WebSocket] Entering inter-hand phase:', {
            hand_result: payload.hand_result,
            ready_players: payload.ready_players,
          })
        } else if (!isInterHandPhase && wasInterHandPhase) {
          console.log('[Table WebSocket] Exiting inter-hand phase, new hand starting')
        }

        // Preserve viewer-specific data (like hero cards) when the broadcast
        // payload omits it. WebSocket broadcasts are public, so they don't
        // include the viewer's hole cards, which we need to keep showing.
        const mergedHero = payload.hero ?? (isSameHand ? previous?.hero ?? null : null)

        // Keep hand result while the hand is still the same
        const mergedHandResult =
          payload.hand_result ?? (isSameHand ? previous?.hand_result ?? null : null)

        // Preserve ready_players during inter-hand phase, or if payload includes it
        // Reset to empty array when starting a new hand (not inter-hand)
        const shouldPreserveReadyPlayers = isInterHandPhase || wasInterHandPhase || isSameHand
        const mergedReadyPlayers =
          payload.ready_players ?? 
          (shouldPreserveReadyPlayers ? previous?.ready_players ?? [] : [])

        const nextState: LiveTableState = {
          ...payload,
          hero: mergedHero,
          hand_result: mergedHandResult,
          ready_players: mergedReadyPlayers,
        }

        syncHandResults(payload.hand_id ?? null, mergedHandResult, isSameHand)
        return nextState
      })

      // When a new hand starts, fetch viewer-specific state (including hero cards)
      if (isNewHand && payload.hand_id !== null) {
        lastHandIdRef.current = payload.hand_id
        console.log('[Table WebSocket] Fetching viewer-specific state for new hand')
        fetchLiveState()
      }
    }, [fetchLiveState, navigate, showToast, syncHandResults, t]),
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
      syncHandResults(state.hand_id ?? null, state.hand_result ?? null)
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

  const heroId = liveState?.hero?.user_id ?? null
  const heroPlayer = liveState?.players.find((p) => p.user_id === heroId)
  const normalizeAllowedActions = useCallback(
    (allowed: AllowedActionsPayload | undefined): AllowedAction[] => {
      if (!allowed) return []
      if (Array.isArray(allowed)) return allowed

      const actions: AllowedAction[] = []

      if (allowed.can_fold) {
        actions.push({ action_type: 'fold' })
      }
      if (allowed.can_check) {
        actions.push({ action_type: 'check' })
      }
      if (allowed.can_call) {
        actions.push({ action_type: 'call', amount: allowed.call_amount ?? 0 })
      }
      if (allowed.can_bet) {
        actions.push({
          action_type: 'bet',
          min_amount: allowed.min_raise_to ?? 0,
          max_amount: allowed.max_raise_to ?? 0,
        })
      }
      if (allowed.can_raise) {
        actions.push({
          action_type: 'raise',
          min_amount: allowed.min_raise_to ?? 0,
          max_amount: allowed.max_raise_to ?? 0,
        })
      }

      return actions
    },
    [],
  )
  const allowedActions = normalizeAllowedActions(liveState?.allowed_actions)
  const callAction = allowedActions.find((action) => action.action_type === 'call')
  const canCheckAction = allowedActions.some((action) => action.action_type === 'check')
  const canCheck = canCheckAction || (callAction?.amount ?? 0) === 0
  const tableStatus = (liveState?.status ?? tableDetails?.status ?? '').toString().toLowerCase()
  const normalizedStatus = tableStatus
  // Robust inter-hand detection: check multiple conditions
  const isInterHand = Boolean(
    normalizedStatus === 'inter_hand_wait' || 
    liveState?.inter_hand_wait === true ||
    liveState?.status?.toLowerCase() === 'inter_hand_wait'
  )
  
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
  
  const inviteUrl = tableDetails?.invite?.game_id
    ? `${window.location.origin}/table/${tableDetails.invite.game_id}`
    : tableDetails?.table_id
      ? `${window.location.origin}/table/${tableDetails.table_id}`
      : ''
  const isMyTurn = liveState?.current_actor === heroId

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

    if (!liveState || !heroId || liveState.current_actor !== heroId || !liveState.action_deadline) {
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
  }, [canCheck, handleGameAction, heroId, liveState?.action_deadline, liveState?.current_actor, liveState?.hand_id])

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
  const heroCards = liveState?.hero?.cards ?? []

  const renderActionDock = () => {
    // Log rendering decision
    const isActiveGameplayCheck = ACTIVE_GAMEPLAY_STREETS.includes(tableStatus) || tableStatus === 'active'
    console.log('[Table ActionDock] Render decision:', {
      isInterHand,
      tableStatus,
      isActiveGameplay: isActiveGameplayCheck,
      viewerIsSeated,
      hasActiveHand: liveState?.hand_id !== null && !isInterHand,
      isMyTurn,
      allowedActionsCount: allowedActions.length,
      allowedActions,
      current_actor: liveState?.current_actor,
      heroId,
    })

    // Never show during inter-hand voting phase
    if (isInterHand) {
      console.log('[Table ActionDock] Hidden: inter-hand phase')
      return null
    }

    // Waiting state - show start/join buttons
    if (tableStatus === 'waiting') {
      console.log('[Table ActionDock] Showing waiting state buttons:', {
        viewerIsCreator,
        viewerIsSeated,
        canStart,
        canJoin,
      })
      return (
        <div className="absolute inset-0 flex items-end justify-center pb-12 z-40 pointer-events-none">
          <div className="flex flex-col items-center gap-4 pointer-events-auto">
            {viewerIsCreator ? (
              <button
                type="button"
                onClick={handleStart}
                disabled={isStarting || !canStart}
                className="min-h-[52px] px-8 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-black font-bold text-lg shadow-2xl shadow-emerald-500/40 hover:from-emerald-400 hover:to-emerald-300 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed animate-pulse"
              >
                {isStarting ? t('table.actions.starting') : t('table.actions.start', { defaultValue: 'START GAME' })}
              </button>
            ) : viewerIsSeated ? (
              <div className="px-4 py-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white/80 min-h-[52px] flex items-center justify-center text-center">
                {t('table.messages.waitingForHost')}
              </div>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={handleSeat}
                disabled={!canJoin || isSeating}
                className="min-h-[52px] px-8"
              >
                {isSeating ? t('table.actions.joining') : t('table.actions.takeSeat', { defaultValue: 'SIT DOWN' })}
              </Button>
            )}
          </div>
        </div>
      )
    }

    // Active hand - show action controls when seated and hand is active
    const hasActiveHand = liveState?.hand_id !== null && !isInterHand
    if (isActiveGameplayCheck && liveState && viewerIsSeated && hasActiveHand) {
      const potSize =
        typeof liveState.pot === 'number'
          ? liveState.pot
          : (liveState as { pot?: { total?: number } }).pot?.total ??
            (liveState.pots?.reduce((sum, pot) => sum + (pot.amount ?? 0), 0) ?? 0)
      console.log('[Table ActionDock] Showing action controls:', {
        allowedActionsCount: allowedActions.length,
        isMyTurn,
        potSize,
        heroStack: heroPlayer?.stack,
      })
      return (
        <ActionDock
          allowedActions={allowedActions}
          onAction={handleGameAction}
          potSize={potSize}
          myStack={heroPlayer?.stack ?? 0}
          isProcessing={actionPending || loading}
          isMyTurn={isMyTurn}
        />
      )
    }

    console.log('[Table ActionDock] Hidden: no matching condition', {
      tableStatus,
      isActiveGameplay: isActiveGameplayCheck,
      viewerIsSeated,
      hasActiveHand,
    })
    return null
  }

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
      
      <SmartTableHeader
        tableId={tableDetails.table_id}
        status={liveState?.status ?? tableDetails.status}
        smallBlind={tableDetails.small_blind}
        bigBlind={tableDetails.big_blind}
        hostName={tableDetails.host?.display_name || tableDetails.host?.username}
        createdAt={tableDetails.created_at}
        inviteUrl={inviteUrl}
        onLeave={canLeave ? handleLeave : undefined}
      />

      {/* Arena - Game Content */}
      {liveState ? (
        <div className="absolute inset-0" style={{ paddingTop: '80px', paddingBottom: viewerIsSeated ? '80px' : '0' }}>
          
          {/* Inter-Hand Wait Overlay */}
          {isInterHand ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/50 backdrop-blur-sm">
              <WinnerShowcase handResult={lastHandResult} players={liveState.players} />
              <div className="mt-6">
                <InterHandVoting
                  players={liveState.players}
                  readyPlayerIds={liveState.ready_players ?? []}
                  deadline={liveState.inter_hand_wait_deadline}
                  durationSeconds={liveState.inter_hand_wait_seconds ?? 20}
                  onReady={handleReady}
                  isReady={(liveState.ready_players ?? []).includes(heroId ?? -1)}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Villains - 8-Player Ring Layout */}
              <div className="absolute inset-0 pointer-events-none" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
                {liveState.players
                  .filter((p) => p.user_id !== heroId)
                  .map((player, index) => {
                    const isActor = player.user_id === liveState.current_actor
                    const isLastActor = liveState.last_action?.user_id === player.user_id
                    const totalOthers = liveState.players.filter((p) => p.user_id !== heroId).length
                    
                    // Compute position in a ring layout (excluding hero at bottom)
                    // For up to 7 other players, arrange in semicircle from left to right
                    const angle = totalOthers > 1 
                      ? (Math.PI / (totalOthers + 1)) * (index + 1) // spread across top half
                      : Math.PI / 2 // single opponent at top center
                    
                    const radiusX = 42 // horizontal radius percentage
                    const radiusY = 38 // vertical radius percentage
                    const left = 50 + radiusX * Math.cos(angle)
                    const top = 50 - radiusY * Math.sin(angle)

                    const getLastActionText = () => {
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
                    }

                    const lastActionText = getLastActionText()
                    
                    // Determine position label (BTN, SB, BB)
                    const positionLabel = player.is_button ? 'BTN' : player.is_small_blind ? 'SB' : player.is_big_blind ? 'BB' : undefined
                    
                    // Determine status
                    const playerStatus = player.is_sitting_out_next_hand 
                      ? 'sit_out' 
                      : !player.in_hand && liveState.hand_id 
                        ? 'folded' 
                        : liveState.hand_id 
                          ? 'active' 
                          : 'waiting'

                    return (
                      <div
                        key={`villain-${player.user_id}`}
                        ref={(el) => {
                          if (el) {
                            playerTileRefs.current.set(player.user_id, el)
                          } else {
                            playerTileRefs.current.delete(player.user_id)
                          }
                        }}
                        className="absolute pointer-events-auto"
                        style={{
                          left: `${left}%`,
                          top: `${top}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <PlayerAvatar
                            name={player.display_name || player.username || `P${(player.seat ?? player.position ?? 0) + 1}`}
                            stack={player.stack}
                            isActive={Boolean(isActor && player.in_hand)}
                            hasFolded={!player.in_hand}
                            betAmount={player.bet}
                            deadline={isActor ? liveState.action_deadline : null}
                            turnTimeoutSeconds={liveState.turn_timeout_seconds || DEFAULT_TURN_TIMEOUT_SECONDS}
                            size="sm"
                            offsetTop={top < 50}
                            seatNumber={player.seat ?? player.position}
                            positionLabel={positionLabel}
                            lastAction={lastActionText}
                            isSittingOut={player.is_sitting_out_next_hand}
                            status={playerStatus}
                          />
                          {lastActionText && player.in_hand && (
                            <p className="text-[8px] font-semibold text-emerald-300 uppercase tracking-wide">
                              {lastActionText}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* Board Center - Pot & Community Cards */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30">
                <div className="flex flex-col items-center gap-4">
                  {/* Pot - Stacked Chip Glass Capsule */}
                  <div 
                    className="rounded-full backdrop-blur-xl bg-black/70 px-4 py-2 border border-amber-500/40 shadow-2xl transition-transform duration-150" 
                    ref={potAreaRef}
                    style={{
                      boxShadow: '0 0 20px rgba(245, 158, 11, 0.15), 0 4px 12px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    {liveState.pots && liveState.pots.length > 1 ? (
                      <div className="text-center">
                        <p className="text-[9px] text-amber-400/80 uppercase tracking-widest font-bold mb-0.5">{t('table.pots.title', { defaultValue: 'Pots' })}</p>
                        <div className="space-y-0.5">
                          {liveState.pots.map((pot, idx) => (
                            <div key={pot.pot_index} className="flex items-baseline justify-center gap-1.5">
                              <span className="text-[9px] text-gray-400">#{idx + 1}</span>
                              <span className="text-sm font-bold text-emerald-400">{pot.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-[9px] text-amber-400/80 uppercase tracking-widest font-bold">{t('table.pot', { amount: '', defaultValue: 'POT' }).replace(/:.*/,'')}</p>
                        <p className="text-lg font-bold text-emerald-400 leading-tight">{liveState.pot}</p>
                      </div>
                    )}
                  </div>

                  {/* Community Cards */}
                  <div className="flex gap-2">
                    {liveState.board && liveState.board.length > 0 ? (
                      liveState.board.map((card, idx) => {
                        const isWinningCard =
                          liveState.hand_result?.winners?.some((winner) => winner.best_hand_cards?.includes(card)) ?? false
                        return <PlayingCard key={`board-${idx}`} card={card} size="sm" highlighted={isWinningCard} />
                      })
                    ) : (
                      <div className="rounded-xl backdrop-blur-md bg-white/5 px-5 py-3 text-xs text-gray-400 border border-white/10">
                        {t('table.waitingForBoard')}
                      </div>
                    )}
                  </div>

                  {/* Hand Result */}
                  {liveState.hand_result && (
                    <div className="mt-2">
                      <HandResultPanel liveState={liveState} currentUserId={heroId} />
                    </div>
                  )}
                </div>
              </div>

              {/* Hero (Bottom Center) */}
              {heroPlayer && (
                <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 z-20">
                  <div
                    ref={(el) => {
                      if (el && heroId) {
                        playerTileRefs.current.set(heroId, el)
                      } else if (heroId) {
                        playerTileRefs.current.delete(heroId)
                      }
                    }}
                    className="flex flex-col items-center"
                  >
                    {/* Hero Cards */}
                    {heroCards.length > 0 && liveState.hand_id && liveState.status !== 'ended' && liveState.status !== 'waiting' && (
                      <div className="flex gap-2.5 mb-3">
                        {heroCards.map((card, idx) => {
                          const heroWinner = liveState.hand_result?.winners?.find((w) => w.user_id === heroId)
                          const isWinningCard = heroWinner?.best_hand_cards?.includes(card) ?? false
                          return (
                            <div
                              key={`hero-card-${idx}`}
                              className="transition-transform"
                              style={{
                                transform: idx === 0 ? 'rotate(-4deg)' : 'rotate(4deg)',
                              }}
                            >
                              <PlayingCard card={card} size="md" highlighted={isWinningCard} />
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <PlayerAvatar
                      name={heroPlayer.display_name || 'You'}
                      stack={heroPlayer.stack}
                      isHero
                      isActive={Boolean(heroPlayer.in_hand && heroPlayer.user_id === liveState.current_actor)}
                      hasFolded={!heroPlayer.in_hand}
                      betAmount={heroPlayer.bet}
                      deadline={heroPlayer.user_id === liveState.current_actor ? liveState.action_deadline : null}
                      turnTimeoutSeconds={liveState.turn_timeout_seconds || DEFAULT_TURN_TIMEOUT_SECONDS}
                      size="md"
                      seatNumber={heroPlayer.seat ?? heroPlayer.position}
                      positionLabel={heroPlayer.is_button ? 'BTN' : heroPlayer.is_small_blind ? 'SB' : heroPlayer.is_big_blind ? 'BB' : undefined}
                      isSittingOut={heroPlayer.is_sitting_out_next_hand}
                      status={heroPlayer.is_sitting_out_next_hand ? 'sit_out' : !heroPlayer.in_hand && liveState.hand_id ? 'folded' : liveState.hand_id ? 'active' : 'waiting'}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Waiting Lobby - No Live State Yet */
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: '80px' }}>
          <div className="max-w-md w-full px-6">
            <div className="backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-8 text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6">
                {tableDetails.status === 'waiting' ? t('table.status.waiting') : t('table.status.loading')}
              </h2>
              
              {/* Player list in waiting state */}
              <div className="mb-8">
                <p className="text-sm text-white/70 mb-4">
                  {t('table.meta.players')}: {tableDetails.player_count} / {tableDetails.max_players}
                </p>
                <div className="space-y-2.5">
                  {players.map((player) => (
                    <div
                      key={`waiting-${player.user_id}-${player.position}`}
                      className="flex items-center justify-between backdrop-blur-md bg-white/10 rounded-xl px-4 py-3 border border-white/20 transition-all hover:bg-white/15"
                    >
                      <span className="text-white text-sm font-medium">
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

              {/* Action buttons */}
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

              {/* Delete button for host */}
              {viewerIsCreator && (
                <div className="mt-8 pt-6 border-t border-white/20">
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

      {renderActionDock()}
    </PokerFeltBackground>
  )
}
