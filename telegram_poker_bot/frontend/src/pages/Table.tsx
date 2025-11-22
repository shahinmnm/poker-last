import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { faUser, faCoins, faUserGroup, faClock } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { useTableWebSocket } from '../hooks/useTableWebSocket'
import { useUserData } from '../providers/UserDataProvider'
import { useLayout } from '../providers/LayoutProvider'
import { apiFetch, ApiError } from '../utils/apiClient'
import Toast from '../components/Toast'
import Countdown from '../components/Countdown'
import PlayerRectTimer from '../components/PlayerRectTimer'
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
import HandResultPanel from '../components/tables/HandResultPanel'
import RecentHandsModal from '../components/tables/RecentHandsModal'
import TableExpiredModal from '../components/tables/TableExpiredModal'
import { ChipFlyManager, type ChipAnimation } from '../components/tables/ChipFly'
import InterHandVoting from '../components/tables/InterHandVoting'
import WinnerShowcase from '../components/tables/WinnerShowcase'
import GameControls from '../components/tables/GameControls'
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
  allowed_actions?: {
    can_fold?: boolean
    can_check?: boolean
    can_call?: boolean
    call_amount?: number
    can_bet?: boolean
    can_raise?: boolean
    min_raise_to?: number
    max_raise_to?: number
    current_pot?: number
    player_stack?: number
  }
  ready_players?: number[]
}

const DEFAULT_TOAST = { message: '', visible: false }
const EXPIRED_TABLE_REDIRECT_DELAY_MS = 2000
const DEFAULT_TURN_TIMEOUT_SECONDS = 25
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
  const [handResult, setHandResult] = useState<LiveTableState['hand_result'] | null>(null)
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

  const syncHandResults = useCallback(
    (
      handId: number | null,
      incomingResult: LiveTableState['hand_result'] | null,
      isSameHand = false,
    ) => {
      setHandResult(incomingResult ?? null)

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
  const { status: wsStatus } = useTableWebSocket({
    tableId: tableId || '',
    enabled: !!tableId,
    onMessage: useCallback((payload: any) => {
      // Handle different message types
      if (payload?.type === 'player_ready') {
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
        // Update state to show inter-hand phase with winner information
        const winners = payload.winners && payload.winners.length > 0 ? payload.winners : null
        setLiveState((previous) => {
          if (!previous) return previous
          return {
            ...previous,
            status: 'INTER_HAND_WAIT',
            inter_hand_wait: true,
            inter_hand_wait_seconds: payload.next_hand_in ?? 20,
            hand_result: winners ? { winners } : previous.hand_result,
          }
        })
        // Update lastHandResult for the winner showcase
        if (winners) {
          setLastHandResult({ winners })
        }
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
        // Refetch table details on player/game state changes
        fetchTable()
      }
    }, [fetchTable, t]),
    onStateChange: useCallback((payload: LiveTableState) => {
      // Check if table has expired
      if (payload.status === 'expired' || payload.table_status === 'expired') {
        showToast(t('table.expiration.expired', { defaultValue: 'Table has expired' }))
        setTimeout(() => navigate('/lobby', { replace: true }), EXPIRED_TABLE_REDIRECT_DELAY_MS)
        return
      }

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

        const mergedReadyPlayers =
          payload.ready_players ?? (isSameHand ? previous?.ready_players ?? [] : [])

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
        fetchLiveState()
      }
    }, [fetchLiveState, navigate, showToast, syncHandResults, t]),
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

  const sendAction = useCallback(
    async (actionType: 'fold' | 'check' | 'call' | 'bet' | 'raise', amount?: number) => {
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
    },
    [fetchLiveState, initData, showToast, syncHandResults, t, tableId],
  )

  const heroId = liveState?.hero?.user_id ?? null
  const heroPlayer = liveState?.players.find((p) => p.user_id === heroId)
  const amountToCall = Math.max((liveState?.current_bet ?? 0) - (heroPlayer?.bet ?? 0), 0)
  const normalizedStatus = (liveState?.status ?? '').toString().toLowerCase()
  const isInterHand = normalizedStatus === 'inter_hand_wait' || liveState?.inter_hand_wait

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

    const canCheck = amountToCall === 0 || Boolean(liveState.allowed_actions?.can_check)
    const deadlineMs = new Date(liveState.action_deadline).getTime()
    const delay = Math.max(0, deadlineMs - Date.now())

    const handleAutoAction = () => {
      const timeoutCount =
        autoTimeoutRef.current.handId === liveState.hand_id ? autoTimeoutRef.current.count : 0

      if (timeoutCount === 0 && canCheck) {
        sendAction('check')
      } else {
        sendAction('fold')
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
  }, [amountToCall, heroId, liveState, sendAction])

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

  const createdAtText = tableDetails.created_at
    ? dateFormatter.format(new Date(tableDetails.created_at))
    : null
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
  const heroCards = liveState?.hero?.cards ?? []

  return (
    <div className="space-y-3">
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
        statusComponent={<ConnectionStatus status={wsStatus} />}
      />

      {liveState && (
        <Card className="glass-panel border border-white/10 bg-white/5 shadow-lg relative overflow-hidden">
          {isInterHand ? (
            <div className="flex flex-col items-center justify-center space-y-6 py-8">
              <WinnerShowcase handResult={lastHandResult} players={liveState.players} />
              <InterHandVoting
                players={liveState.players}
                readyPlayerIds={liveState.ready_players ?? []}
                deadline={liveState.inter_hand_wait_deadline}
                durationSeconds={liveState.inter_hand_wait_seconds ?? 20}
                onReady={handleReady}
                isReady={(liveState.ready_players ?? []).includes(heroId ?? -1)}
              />
            </div>
          ) : (
            <>
              {/* Game Status Header - Compact */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--text-muted)] mb-0.5">
                    {t('table.statusLabel')}
                  </p>
                  <p className="text-base font-semibold text-[color:var(--text-primary)]">
                    {liveState.hand_result
                      ? 'SHOWDOWN'
                      : liveState.street
                      ? liveState.street.charAt(0).toUpperCase() + liveState.street.slice(1)
                      : 'Waiting'}
                  </p>
                </div>
                <div className="text-center px-3 py-1.5 rounded-lg bg-white/5 border border-white/10" ref={potAreaRef}>
                  <p className="text-[10px] text-[color:var(--text-muted)] mb-0.5">
                    {liveState.pots && liveState.pots.length > 1
                      ? t('table.pots.title')
                      : t('table.pot', { amount: liveState.pot })}
                  </p>
                  {liveState.pots && liveState.pots.length > 1 ? (
                    <div className="space-y-0.5">
                      {liveState.pots.map((pot) => (
                        <div key={pot.pot_index} className="text-xs">
                          <span className="text-[color:var(--text-muted)]">
                            #{pot.pot_index + 1}:
                          </span>{' '}
                          <span className="font-bold text-emerald-400">{pot.amount}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-emerald-400">{liveState.pot}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[color:var(--text-muted)] mb-0.5">{t('table.blinds')}</p>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                    {`${tableDetails.small_blind}/${tableDetails.big_blind}`}
                  </p>
                </div>
              </div>

              {/* Community Cards */}
              <div className="py-2.5">
                <div className="flex items-center justify-center gap-1">
                  {liveState.board && liveState.board.length > 0 ? (
                    liveState.board.map((card, idx) => {
                      const isWinningCard =
                        liveState.hand_result?.winners?.some((winner) => winner.best_hand_cards?.includes(card)) ?? false
                      return <PlayingCard key={`board-${idx}`} card={card} size="sm" highlighted={isWinningCard} />
                    })
                  ) : (
                    <div className="rounded-lg bg-black/20 px-2.5 py-1.5 text-[10px] text-[color:var(--text-muted)]">
                      {t('table.waitingForBoard')}
                    </div>
                  )}
                </div>
              </div>

              {/* Hand Result Panel */}
              <HandResultPanel liveState={liveState} currentUserId={heroId} />

              {/* Players Grid - More Compact */}
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 py-2.5 border-t border-white/10">
                {liveState.players.map((player) => {
                  const isActor = player.user_id === liveState.current_actor
                  const isHero = player.user_id === heroId
                  const isLastActor = liveState.last_action?.user_id === player.user_id

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

                  return (
                    <div
                      key={`${player.user_id}-${player.seat}`}
                      ref={(el) => {
                        if (el) {
                          playerTileRefs.current.set(player.user_id, el)
                        } else {
                          playerTileRefs.current.delete(player.user_id)
                        }
                      }}
                      className={`rounded-lg border px-2 py-1.5 backdrop-blur-sm transition-all relative ${
                        isActor
                          ? 'border-white/25 bg-emerald-500/10 shadow-md shadow-emerald-500/20'
                          : isHero
                          ? 'border-sky-400/50 bg-sky-500/10'
                          : 'border-white/10 bg-white/5'
                      }`}
                    >
                      {/* Timer Border - Only show for current actor who is not sitting out and not folded */}
                      {isActor && !player.is_sitting_out_next_hand && player.in_hand && liveState.action_deadline && (
                        <PlayerRectTimer
                          deadline={liveState.action_deadline}
                          turnTimeoutSeconds={liveState.turn_timeout_seconds || DEFAULT_TURN_TIMEOUT_SECONDS}
                          className="rounded-lg"
                        />
                      )}
                      <div className="flex items-center justify-between text-[11px]">
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
                          {isHero && (
                            <span className="rounded-full bg-sky-500/20 text-sky-300 px-1.5 py-0.5">YOU</span>
                          )}
                        </div>
                      </div>
                      {player.is_sitting_out_next_hand && (
                        <div className="mt-0.5">
                          <span className="text-[8px] uppercase tracking-wide text-orange-400/80 bg-orange-500/10 px-1.5 py-0.5 rounded">
                            {t('table.sitOut')}
                          </span>
                        </div>
                      )}
                      <div className="mt-1 flex items-center justify-between text-[10px]">
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
                        <p className="mt-0.5 text-[9px] text-rose-400/80">{t('table.folded')}</p>
                      )}
                      {lastActionText && player.in_hand && (
                        <p className="mt-0.5 text-[9px] font-semibold" style={{ color: isLastActor ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {lastActionText}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Hero Cards - Compact - Only show during active hand */}
              {liveState.hand_id && liveState.status !== 'ended' && liveState.status !== 'waiting' && (
                <div className="pt-2.5 border-t border-white/10">
                  <div className="flex flex-col items-center gap-1.5 rounded-lg border border-white/10 bg-gradient-to-br from-white/5 to-transparent px-2.5 py-2 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-[color:var(--text-muted)]">
                      {t('table.yourHand')}
                    </p>
                    <div className="flex gap-1.5">
                      {heroCards.length ? (
                        heroCards.map((card, idx) => {
                          const heroWinner = liveState.hand_result?.winners?.find((w) => w.user_id === heroId)
                          const isWinningCard = heroWinner?.best_hand_cards?.includes(card) ?? false
                          return <PlayingCard key={`hero-${idx}`} card={card} size="md" highlighted={isWinningCard} />
                        })
                      ) : (
                        <span className="text-[10px] text-[color:var(--text-muted)]">
                          {t('table.waitingForHand')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {liveState && viewerIsSeated && (
        <Card className="glass-panel border border-white/10 bg-white/5">
          <TableActionButtons
            isPlayerTurn={liveState.current_actor === heroId}
            amountToCall={amountToCall}
            minRaise={liveState.allowed_actions?.min_raise_to || liveState.min_raise}
            maxRaise={liveState.allowed_actions?.max_raise_to}
            playerStack={heroPlayer?.stack || 0}
            playerBet={heroPlayer?.bet || 0}
            actionPending={actionPending}
            currentPot={liveState.allowed_actions?.current_pot || liveState.pot}
            onFold={() => sendAction('fold')}
            onCheckCall={() => sendAction(amountToCall > 0 ? 'call' : 'check')}
            onBet={(amount) => sendAction('bet', amount)}
            onRaise={(amount) => sendAction('raise', amount)}
            onAllIn={() => sendAction('raise', (heroPlayer?.stack || 0) + (heroPlayer?.bet || 0))}
          />
          {heroPlayer && heroPlayer.stack < (tableDetails.starting_stack * 0.2) && (
            <div className="mt-3 pt-3 border-t border-white/10">
              <button
                disabled
                className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity"
                style={{
                  background: 'var(--glass-bg-elevated)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-muted)',
                  opacity: 0.6,
                  cursor: 'not-allowed',
                }}
              >
                {t('table.actions.rebuy')} ({t('common.comingSoon')})
              </button>
            </div>
          )}
        </Card>
      )}

      {liveState && tableDetails.status === 'active' && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowRecentHands(true)}
            className="rounded-xl px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            {t('table.recentHands.title')}
          </button>
        </div>
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

      {/* Countdown Timer (only for WAITING tables - no countdown after game starts) */}
      {tableDetails.expires_at && tableDetails.status === 'waiting' && (
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
                  setTimeout(() => navigate('/lobby'), EXPIRED_TABLE_REDIRECT_DELAY_MS)
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
                  : tableDetails.status === 'active' && handResult
                  ? t('table.messages.waitingForNextHand', 'Waiting for players to join next hand...')
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
                  disabled={!canStart || isStarting || tableDetails.status === 'active'}
                >
                  {isStarting
                    ? t('table.actions.starting')
                    : t('table.actions.start')
                  }
                </Button>
                {!canStart && missingPlayers > 0 && (
                  <p className="text-[10px] text-amber-400 px-1">
                    ⚠️ {t('table.messages.waitForPlayers', { count: missingPlayers })}
                  </p>
                )}
                {canStart && tableDetails.status === 'active' && handResult && (
                  <p className="text-[10px] text-emerald-400 px-1">
                    ✓ {t('table.messages.readyForNextHand', 'Ready to deal next hand')}
                  </p>
                )}
                {canStart && tableDetails.status !== 'active' && (
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

      {/* Game Controls - Fixed bottom when seated */}
      {liveState && viewerIsSeated && !isInterHand && (
        <GameControls
          isPlayerTurn={liveState.current_actor === heroId}
          amountToCall={amountToCall}
          minRaise={liveState.allowed_actions?.min_raise_to || liveState.min_raise}
          maxRaise={liveState.allowed_actions?.max_raise_to || (heroPlayer?.stack || 0) + (heroPlayer?.bet || 0)}
          currentPot={liveState.allowed_actions?.current_pot || liveState.pot}
          actionPending={actionPending}
          onFold={() => sendAction('fold')}
          onCheckCall={() => sendAction(amountToCall > 0 ? 'call' : 'check')}
          onBet={(amount) => sendAction('bet', amount)}
          onRaise={(amount) => sendAction('raise', amount)}
        />
      )}
    </div>
  )
}
