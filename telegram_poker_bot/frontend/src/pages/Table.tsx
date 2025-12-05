import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { useTableWebSocket } from '../legacy/hooks/useTableWebSocket'
import { useUserData } from '../providers/UserDataProvider'
import { useLayout } from '../providers/LayoutProvider'
import { apiFetch, ApiError } from '../utils/apiClient'
import Toast from '../components/Toast'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ExpiredTableView from '../legacy/ui/lobby-legacy/tables/ExpiredTableView'
import HandResultPanel from '../legacy/ui/lobby-legacy/tables/HandResultPanel'
import RecentHandsModal from '../legacy/ui/lobby-legacy/tables/RecentHandsModal'
import TableExpiredModal from '../legacy/ui/lobby-legacy/tables/TableExpiredModal'
import { ChipFlyManager, type ChipAnimation } from '../legacy/ui/lobby-legacy/tables/ChipFly'
import InterHandVoting from '../legacy/ui/lobby-legacy/tables/InterHandVoting'
import WinnerShowcase from '../legacy/ui/lobby-legacy/tables/WinnerShowcase'
import PokerFeltBackground from '../components/background/PokerFeltBackground'
import GameVariantBadge from '../components/ui/GameVariantBadge'
import CommunityBoard from '@/legacy/ui/table-legacy/table/CommunityBoard'
import ActionBar from '@/legacy/ui/table-legacy/table/ActionBar'
import DynamicPokerTable from '@/components/table/DynamicPokerTable'
import PlayerSeat from '@/legacy/ui/table-legacy/table/PlayerSeat'
import { getSeatLayout } from '@/config/tableLayout'
import { useGameVariant } from '@/utils/gameVariant'
import { CurrencyType, formatByCurrency } from '@/utils/currency'
import { extractRuleSummary, getTemplateConfig } from '@/utils/tableRules'
import '../styles/table-layout.css'
import type {
  AllowedAction,
  AllowedActionsPayload,
  HandResultPayload,
  TablePlayerState,
  TableState,
} from '@/types/game'
import type { GameVariant } from '@/types'

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
  player_count: number
  max_players: number
  starting_stack?: number
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
  game_variant?: GameVariant
  is_persistent?: boolean
  currency_type?: CurrencyType
  template?: {
    id: number | string
    table_type: string
    config: Record<string, any>
    config_json?: Record<string, any>
    has_waitlist?: boolean
  } | null
}

type LastAction = NonNullable<TableState['last_action']>

const TABLE_CENTER_Y_APPROX = 56

const DEFAULT_TOAST = { message: '', visible: false }
const EXPIRED_TABLE_REDIRECT_DELAY_MS = 2000
const TABLE_CAPSULE_MENU_WIDTH = '50vw'
const TABLE_CAPSULE_STYLE: CSSProperties = {
  width: TABLE_CAPSULE_MENU_WIDTH,

}
/**
 * Street names that indicate active gameplay.
 * During gameplay, liveState.status contains the current street name (preflop, flop, turn, river)
 * rather than 'active'. Action buttons should be shown when tableStatus is one of these values.
 */
const ACTIVE_GAMEPLAY_STREETS = ['preflop', 'flop', 'turn', 'river']

const notifyLobbyTableRemoved = (tableId?: number | string | null) => {
  const numericId = Number(tableId)
  if (!Number.isFinite(numericId)) return

  window.dispatchEvent(
    new CustomEvent('lobby:table-removed', {
      detail: { tableId: numericId },
    }),
  )
}

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { initData, user } = useTelegram()
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
  const [liveState, setLiveState] = useState<TableState | null>(null)
  const [lastHandResult, setLastHandResult] =
    useState<TableState['hand_result'] | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [chipAnimations, setChipAnimations] = useState<ChipAnimation[]>([])
  const [showRecentHands, setShowRecentHands] = useState(false)
  const [turnProgress, setTurnProgress] = useState(1)

  const [showTableExpiredModal, setShowTableExpiredModal] = useState(false)
  const [tableExpiredReason, setTableExpiredReason] = useState('')
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showVariantRules, setShowVariantRules] = useState(false)
  const variantConfig = useGameVariant(tableDetails?.game_variant)

  const autoTimeoutRef = useRef<{ handId: number | null; count: number }>({ handId: null, count: 0 })
  const autoActionTimerRef = useRef<number | null>(null)
  
  // Refs for tracking elements for animations
  const playerTileRefs = useRef<Map<string, HTMLElement>>(new Map())
  const tableMenuButtonRef = useRef<HTMLButtonElement | null>(null)
  const tableMenuRef = useRef<HTMLDivElement | null>(null)
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

  useEffect(() => {
    if (variantConfig.id === 'no_limit_short_deck_holdem') {
      setShowVariantRules(true)
      const timer = window.setTimeout(() => setShowVariantRules(false), 9000)
      return () => window.clearTimeout(timer)
    }
    setShowVariantRules(false)
    return undefined
  }, [variantConfig.id])

  // Close the table menu when clicking outside the button or the menu itself
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!showTableMenu) return
      const menuEl = tableMenuRef.current
      const btnEl = tableMenuButtonRef.current
      const target = e.target as Node
      if (menuEl && menuEl.contains(target)) return
      if (btnEl && btnEl.contains(target)) return
      setShowTableMenu(false)
    }

    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showTableMenu])

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

  const lastSourceRef = useRef<'ws' | 'rest' | null>(null)
  const hasWsStateRef = useRef<boolean>(false)

  const applyIncomingState = useCallback(
    (incoming: TableState, source: 'ws' | 'rest' = 'ws') => {
      setLiveState((previous) => {
        // Drop stale payloads (e.g., an older REST "waiting" response arriving after a WS hand state)
        const previousHandId = previous?.hand_id ?? null
        const incomingHandId = incoming.hand_id ?? null
        const incomingIsOlderHand =
          previousHandId !== null &&
          (incomingHandId === null || incomingHandId < previousHandId)
        if (incomingIsOlderHand) {
          console.warn('STATE UPDATE IGNORED (stale hand)', {
            source,
            previousHandId,
            incomingHandId,
            previousStatus: previous?.status,
            incomingStatus: incoming.status,
          })
          return previous ?? incoming
        }

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

        const mergedAllowedActions = incoming.allowed_actions
        const mergedAllowedActionsLegacy = (incoming as any)?.allowed_actions_legacy

        // If REST payload would clear actor actions while WS already provided them, ignore it.
        if (
          source === 'rest' &&
          lastSourceRef.current === 'ws' &&
          isSameHand &&
          Array.isArray(previous?.allowed_actions) &&
          previous.allowed_actions.length > 0 &&
          Array.isArray(incoming.allowed_actions) &&
          incoming.allowed_actions.length === 0
        ) {
          return previous ?? incoming
        }
        if (
          source === 'rest' &&
          lastSourceRef.current === 'ws' &&
          isSameHand &&
          Array.isArray((previous as any)?.allowed_actions_legacy) &&
          (previous as any)?.allowed_actions_legacy?.length > 0 &&
          Array.isArray((incoming as any)?.allowed_actions_legacy) &&
          (incoming as any)?.allowed_actions_legacy?.length === 0
        ) {
          return previous ?? incoming
        }

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
          allowed_actions:
            mergedAllowedActions ??
            (isSameHand ? previous?.allowed_actions : undefined),
          allowed_actions_legacy:
            mergedAllowedActionsLegacy ??
            (isSameHand ? previous?.allowed_actions_legacy : undefined),
        }

        if (source === 'ws') {
          hasWsStateRef.current = true
        }
        lastSourceRef.current = source
        console.log('STATE UPDATE', {
          source,
          actor: nextState.current_actor_user_id ?? nextState.current_actor,
          allowed: nextState.allowed_actions,
        })

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
      applyIncomingState(data, 'rest')
    } catch (err) {
      console.warn('Unable to fetch live state', err)
    }
  }, [applyIncomingState, tableId])

  // Fallback hero ID to tableDetails.viewer when liveState.hero is missing (WS is unauthenticated)
  const heroId =
    liveState?.hero?.user_id ??
    tableDetails?.viewer?.user_id ??
    user?.id ??
    null
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
  const formatLastActionText = useCallback(
    (userId?: string | number | null) => {
      if (!userId || !liveState?.last_action) return null
      if (liveState.last_action.user_id?.toString() !== userId.toString()) return null

      const { action, amount } = liveState.last_action

      if (action === 'fold') return t('table.actions.lastAction.fold')
      if (action === 'check') return t('table.actions.lastAction.check')
      if (action === 'call' && amount) return t('table.actions.lastAction.call', { amount })
      if (action === 'bet' && amount) return t('table.actions.lastAction.bet', { amount })
      if (action === 'raise' && amount) return t('table.actions.lastAction.raise', { amount })
      if (action === 'all_in' && amount) return t('table.actions.lastAction.all_in', { amount })
      return null
    },
    [liveState?.last_action, t],
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
          applyIncomingState(state as TableState, 'rest')
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
          notifyLobbyTableRemoved(tableId)
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
  const { waitForConnection, status: wsStatus } = useTableWebSocket({
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
          applyIncomingState(payload as TableState, 'ws')
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

          applyIncomingState(interHandState, 'ws')
          if (handResult) {
            setLastHandResult(handResult)
          }
          return
        }

        if (payload?.type === 'table_ended') {
          notifyLobbyTableRemoved(payload.table_id ?? tableId ?? null)
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
          notifyLobbyTableRemoved(payload.table_id ?? tableId ?? null)
          showToast(t('table.expiration.expired', { defaultValue: 'Table has expired' }))
          setTimeout(() => navigate('/lobby', { replace: true }), EXPIRED_TABLE_REDIRECT_DELAY_MS)
          return
        }

        applyIncomingState(payload, 'ws')

        const isNewHand = payload.hand_id !== null && lastHandIdRef.current !== payload.hand_id
        if (isNewHand && payload.hand_id !== null) {
          lastHandIdRef.current = payload.hand_id
        }
      },
      [applyIncomingState, navigate, showToast, t],
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
      const state = await apiFetch<TableState>(`/tables/${tableId}/start`, {
        method: 'POST',
        initData,
      })
      applyIncomingState(state, 'rest')
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

  const allowedActionsSource =
    liveState?.allowed_actions ?? liveState?.allowed_actions_legacy
  const allowedActions = normalizeAllowedActions(allowedActionsSource)
  const callAction = allowedActions.find((action) => action.action_type === 'call')
  const canCheckAction = allowedActions.some((action) => action.action_type === 'check')
  const canCheck = canCheckAction || (callAction?.amount ?? 0) === 0
  const tableStatus = (liveState?.status ?? tableDetails?.status ?? '').toString().toLowerCase()
  const normalizedStatus = tableStatus
  const viewerIsCreator = tableDetails?.viewer?.is_creator ?? false
  const viewerIsSeated =
    tableDetails?.viewer?.is_seated ??
    Boolean(heroId && liveState?.players?.some((p) => p.user_id?.toString() === heroId.toString()))

  // Derive canStart from liveState for real-time responsiveness (per spec: must depend on WS liveState)
  const livePlayerCount = liveState?.players?.length ?? tableDetails?.player_count ?? 0
  const hasActiveHand = liveState?.hand_id !== null && liveState?.status !== 'waiting'
  const canStart =
    viewerIsCreator &&
    livePlayerCount >= 2 &&
    ((tableDetails?.status === 'waiting') || (tableDetails?.status === 'active' && !hasActiveHand))

  const canJoin = tableDetails?.permissions?.can_join ?? false
  const canLeave = tableDetails?.permissions?.can_leave ?? false
  const missingPlayers = Math.max(0, 2 - livePlayerCount)
  const players = (tableDetails?.players || []).slice().sort((a, b) => a.position - b.position)
  const templateRules = useMemo(
    () =>
      extractRuleSummary(tableDetails?.template ?? null, {
        max_players: tableDetails?.max_players,
        currency_type: tableDetails?.currency_type as CurrencyType | string | undefined,
        table_name: tableDetails?.table_name ?? null,
      }),
    [tableDetails?.currency_type, tableDetails?.max_players, tableDetails?.table_name, tableDetails?.template],
  )
  const uiSchema = useMemo(() => {
    const tpl = tableDetails?.template as any
    const configJson = tpl?.config_json ?? tpl?.config
    return configJson?.ui_schema
  }, [tableDetails?.template])
  const tableMaxPlayers = templateRules.maxPlayers ?? tableDetails?.max_players ?? 0
  const tableStartingStack = templateRules.startingStack ?? tableDetails?.starting_stack ?? 0
  const stakesLabel = templateRules.stakesLabel ?? null
  const currencyType: CurrencyType =
    (liveState?.currency_type as CurrencyType | undefined) ||
    (templateRules.currencyType as CurrencyType | undefined) ||
    (tableDetails?.currency_type as CurrencyType | undefined) ||
    'REAL'
  const stakesDisplay = useMemo(() => {
    const small = templateRules.stakes?.small
    const big = templateRules.stakes?.big
    if (small !== undefined && big !== undefined) {
      return `${formatByCurrency(small, currencyType, { withDecimals: currencyType === 'REAL' })} / ${formatByCurrency(big, currencyType, { withDecimals: currencyType === 'REAL' })}`
    }
    return stakesLabel ?? '—'
  }, [currencyType, stakesLabel, templateRules.stakes?.big, templateRules.stakes?.small])
  const startingStackDisplay =
    tableStartingStack > 0
      ? formatByCurrency(tableStartingStack, currencyType, { withDecimals: currencyType === 'REAL' })
      : null
  const potDisplayAmount = useMemo(() => {
    if (typeof liveState?.pot === 'number') return liveState.pot
    if (liveState?.pots?.length) {
      return liveState.pots.reduce((sum, pot) => sum + (pot.amount ?? 0), 0)
    }
    return 0
  }, [liveState?.pot, liveState?.pots])
  const formattedPot = useMemo(
    () => formatByCurrency(potDisplayAmount, currencyType, { withDecimals: currencyType === 'REAL' }),
    [potDisplayAmount, currencyType],
  )
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

  const heroSeatNumber = heroPlayer?.seat ?? heroPlayer?.position ?? null
  const occupiedSeatNumbers = useMemo(() => {
    const seats = new Set<number>()
    liveState?.players?.forEach((player) => {
      seats.add(player.seat ?? player.position ?? 0)
    })
    return Array.from(seats).sort((a, b) => a - b)
  }, [liveState?.players])

  const suggestedSeatNumber = useMemo(() => {
    if (viewerIsSeated || !canJoin) return null

    const capacity = Math.min(tableMaxPlayers || occupiedSeatNumbers.length + 1, 8)
    for (let i = 0; i < capacity; i += 1) {
      if (!occupiedSeatNumbers.includes(i)) return i
    }

    return null
  }, [canJoin, occupiedSeatNumbers, tableMaxPlayers, viewerIsSeated])

  const visibleSeatNumbers = useMemo(() => {
    const seats = [...occupiedSeatNumbers]
    if (suggestedSeatNumber !== null) seats.unshift(suggestedSeatNumber)

    if (!seats.length) return [0]
    return seats
  }, [occupiedSeatNumbers, suggestedSeatNumber])

  const seatLayout = useMemo(
    () => getSeatLayout(visibleSeatNumbers.length),
    [visibleSeatNumbers.length],
  )
  const seatOrder = useMemo(() => {
    const seats = visibleSeatNumbers
    if (heroSeatNumber === null || heroSeatNumber === undefined) return seats

    const heroIndex = seats.indexOf(heroSeatNumber)
    if (heroIndex === -1) return seats

    return [...seats.slice(heroIndex), ...seats.slice(0, heroIndex)]
  }, [heroSeatNumber, visibleSeatNumbers])

  const playersBySeat = useMemo(() => {
    const map = new Map<number, TablePlayerState>()
    liveState?.players?.forEach((player) => {
      const seatNo = player.seat ?? player.position ?? 0
      map.set(seatNo, player)
    })
    return map
  }, [liveState?.players])

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

  const lastActorRef = useRef<string | null>(null)
  useEffect(() => {
    const actor = currentActorUserId ? currentActorUserId.toString() : null
    if (actor !== lastActorRef.current) {
      lastActorRef.current = actor
      console.log('[Table] Allowed actions for current actor changed', {
        actor,
        allowed_actions: allowedActions,
        raw_allowed_actions: liveState?.allowed_actions,
      })
    }
  }, [allowedActions, currentActorUserId, liveState?.allowed_actions])

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

  useEffect(() => {
    if (!liveState?.action_deadline) {
      setTurnProgress(1)
      return
    }

    const deadlineMs = new Date(liveState.action_deadline).getTime()
    const totalMs = Math.max(2000, (liveState?.turn_timeout_seconds ?? 12) * 1000)

    const updateProgress = () => {
      const remaining = Math.max(0, deadlineMs - Date.now())
      const pct = Math.max(0, Math.min(1, remaining / totalMs))
      setTurnProgress(pct)
    }

    updateProgress()
    const interval = window.setInterval(updateProgress, 120)
    return () => window.clearInterval(interval)
  }, [liveState?.action_deadline, liveState?.turn_timeout_seconds])

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
        tableName={templateRules.tableName ?? tableDetails.table_name}
        templateId={tableDetails.template?.id ?? null}
        templateConfig={getTemplateConfig(tableDetails.template ?? null)}
        maxPlayers={tableMaxPlayers}
        isPrivate={tableDetails.visibility === 'private' || tableDetails.is_private}
      />
    )
  }

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
      current_actor: currentActorUserId,
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
      if (viewerIsCreator) {
        return (
          <div className="table-action-dock z-40">
            <div className="pointer-events-auto flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={handleStart}
                disabled={isStarting || !canStart}
                className="min-h-[52px] px-8 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-black font-bold text-lg shadow-2xl shadow-emerald-500/40 hover:from-emerald-400 hover:to-emerald-300 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed animate-pulse"
              >
                {isStarting ? t('table.actions.starting') : t('table.actions.start', { defaultValue: 'START GAME' })}
              </button>
            </div>
          </div>
        )
      }

      if (viewerIsSeated) {
        return (
          <div className="table-action-dock z-40">
            <div className="pointer-events-auto px-4 py-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 text-white/80 min-h-[52px] flex items-center justify-center text-center">
              {t('table.messages.waitingForHost')}
            </div>
          </div>
        )
      }

      return null
    }

    // Active hand - show action controls when seated and hand is active
    const hasActiveHand = liveState?.hand_id !== null && !isInterHand
    if (
      isActiveGameplayCheck &&
      liveState &&
      viewerIsSeated &&
      hasActiveHand &&
      currentActorUserId
    ) {
      console.log('[Table ActionDock] Showing action controls:', {
        allowedActionsCount: allowedActions.length,
        isMyTurn,
        potSize: potDisplayAmount,
        heroStack: heroPlayer?.stack,
      })
      return (
        <ActionBar
          allowedActions={allowedActions}
          onAction={handleGameAction}
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
      
      {uiSchema && (
        <div className="mb-6 flex justify-center">
          <DynamicPokerTable template={uiSchema} />
        </div>
      )}

      <div className="table-screen">
        {/* Arena - Game Content */}
        {liveState ? (
          <div className="flex flex-1 flex-col gap-3">
            <div className="relative flex-1">
              {isInterHand ? (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
                  <WinnerShowcase handResult={lastHandResult} players={liveState.players} currencyType={currencyType} />
                  <div className="mt-6">
                    <InterHandVoting
                      players={liveState.players}
                      readyPlayerIds={readyPlayerIds}
                      deadline={liveState.inter_hand_wait_deadline}
                      durationSeconds={liveState.inter_hand_wait_seconds ?? 20}
                      onReady={handleReady}
                      isReady={heroIdString !== null && readyPlayerIds.includes(heroIdString)}
                    />
                  </div>
                </div>
              ) : null}

              <div className="table-wrapper">
                <div
                  className="table-area table-bottom-padding relative"
                  style={{ '--seat-row-offset': viewerIsSeated ? '72vh' : '68vh' } as CSSProperties}
                >
                  <div className="table-oval z-0">
                    <div className="absolute inset-0 rounded-[999px] bg-[radial-gradient(circle_at_30%_30%,_rgba(34,197,94,0.16)_0%,_rgba(6,78,59,0.65)_55%,_rgba(6,47,26,0.9)_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.45)] ring-4 ring-emerald-500/35" />
                    <div className="absolute inset-[10px] rounded-[999px] border-[12px] border-emerald-200/35 shadow-inner shadow-emerald-900/50" />
                    <div className="absolute inset-[22px] rounded-[999px] bg-gradient-to-b from-white/15 via-transparent to-white/10 opacity-80" />
                  </div>

                  {tableDetails && (
                    <div className="table-header-capsule pointer-events-none z-30">
                      <button
                        ref={tableMenuButtonRef}
                        type="button"
                        onClick={() => setShowTableMenu((prev) => !prev)}
                        className="pointer-events-auto flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white shadow-lg shadow-emerald-900/50 backdrop-blur-lg transition hover:bg-white/25 w-[50vw] max-w-[95%]"
                        style={TABLE_CAPSULE_STYLE}
                      >
                        <span
                          className={`h-2 w-2 rounded-full shadow-[0_0_0_6px_rgba(16,185,129,0.28)] ${
                            wsStatus === 'connected'
                              ? 'bg-emerald-300'
                                              : wsStatus === 'connecting'
                                                ? 'bg-amber-300 animate-pulse'
                                                : 'bg-rose-400 animate-pulse'
                                          }`}
                                        />
                        {t('table.meta.tableMenu', { defaultValue: 'Table Capsule' })}
                        <GameVariantBadge variant={tableDetails.game_variant} size="sm" className="ml-2" />
                      </button>

                      {showTableMenu && (
                        <div
                          ref={tableMenuRef}
                          className="pointer-events-auto rounded-3xl border border-white/15 bg-white/12 p-3 text-white shadow-2xl shadow-emerald-900/40 backdrop-blur-xl w-[50vw] max-w-[95%] text-sm"
                          style={TABLE_CAPSULE_STYLE}
                        >
                          <div className="mb-4 grid grid-cols-1 gap-3 text-center sm:grid-cols-[1fr_auto] sm:items-center sm:text-left">
                            <div className="space-y-1">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">{t('table.meta.table', { defaultValue: 'Table' })}</p>
                              <p className="text-base font-semibold leading-tight">{templateRules.tableName ?? tableDetails.table_name ?? t('table.meta.unnamed', { defaultValue: 'Friendly game' })}</p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                              <div className="rounded-full bg-emerald-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-100">
                                {tableDetails.visibility === 'private' || tableDetails.is_private ? t('table.meta.private', { defaultValue: 'Private' }) : t('table.meta.public', { defaultValue: 'Public' })}
                              </div>
                              <GameVariantBadge variant={tableDetails.game_variant} size="lg" />
                            </div>
                          </div>

                          <div className="mb-4 grid grid-cols-2 gap-3 text-xs text-emerald-50/90">
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center sm:text-left">
                              <p className="text-[10px] uppercase tracking-[0.14em] text-white/60">{t('table.meta.stakes', { defaultValue: 'Stakes' })}</p>
                              <p className="text-sm font-semibold leading-snug">{stakesDisplay}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center sm:text-left">
                              <p className="text-[10px] uppercase tracking-[0.14em] text-white/60">{t('table.meta.players', { defaultValue: 'Players' })}</p>
                              <p className="text-sm font-semibold leading-snug">{tableDetails.player_count} / {tableMaxPlayers}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center sm:text-left">
                              <p className="text-[10px] uppercase tracking-[0.14em] text-white/60">{t('table.meta.stack', { defaultValue: 'Stack' })}</p>
                              <p className="text-sm font-semibold leading-snug">
                                {startingStackDisplay ?? '—'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center sm:text-left">
                              <p className="text-[10px] uppercase tracking-[0.14em] text-white/60">{t('table.meta.pot', { defaultValue: 'Pot' })}</p>
                              <p className="text-sm font-semibold leading-snug">{formattedPot}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              block
                              onClick={() => setShowRecentHands(true)}
                            >
                              {t('table.actions.recentHands', { defaultValue: 'Recent hands' })}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              block
                              onClick={handleLeave}
                              disabled={!canLeave || isLeaving}
                            >
                              {isLeaving ? t('table.actions.leaving') : t('table.actions.leave', { defaultValue: 'Leave table' })}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {variantConfig.id === 'no_limit_short_deck_holdem' && showVariantRules ? (
                    <div
                      className="pointer-events-auto absolute bottom-6 right-6 z-20 flex items-center gap-3 rounded-full border px-4 py-2 text-xs text-amber-100 shadow-xl backdrop-blur-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,193,7,0.12), rgba(255,87,34,0.18))',
                        borderColor: 'rgba(255,193,7,0.3)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.35)',
                      }}
                    >
                      <span className="text-lg">⚠️</span>
                      <div className="flex flex-col leading-tight">
                        <span className="font-semibold uppercase tracking-wide">Short Deck Tips</span>
                        <span className="text-[11px] opacity-80">Flush beats Full House • No 2-5 cards</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowVariantRules(false)}
                        className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/20"
                      >
                        Hide
                      </button>
                    </div>
                  ) : null}

                  <div className="table-board-stack z-20 flex flex-col items-center gap-2 px-3 sm:px-4">
                    <CommunityBoard
                      potAmount={potDisplayAmount}
                      currencyType={currencyType}
                      cards={liveState.board ?? []}
                      highlightedCards={winningBoardCards}
                      potRef={potAreaRef}
                    />
                    {liveState.hand_result && (
                      <div className="mt-0.5 flex justify-center">
                        <HandResultPanel liveState={liveState} currentUserId={heroId} />
                      </div>
                    )}
                  </div>

                  {seatLayout.map((slot, layoutIndex) => {
                    const seatNumber = seatOrder[layoutIndex] ?? layoutIndex
                    const player = playersBySeat.get(seatNumber)
                    const playerKey = player?.user_id?.toString()
                    const isHeroPlayer = heroIdString !== null && playerKey === heroIdString
                    const isHeroSlot = slot.isHeroPosition
                    const displayName = player?.display_name || player?.username || (isHeroSlot && !player
                      ? t('table.actions.takeSeat', { defaultValue: 'Take your seat' })
                      : t('table.meta.unknown'))

                    const positionLabel = player
                      ? player.is_button
                        ? 'BTN'
                        : player.is_small_blind
                          ? 'SB'
                          : player.is_big_blind
                            ? 'BB'
                            : undefined
                      : undefined

                    const lastActionText = player ? formatLastActionText(player.user_id) : null
                    const playerCards = playerKey ? showdownCardsByPlayer.get(playerKey) ?? [] : []
                    const isActivePlayer = Boolean(
                      player?.in_hand && playerKey === currentActorUserId?.toString(),
                    )
                    const hasFolded = Boolean(player && !player.in_hand && liveState?.hand_id)
                    const seatLabel = t('table.seat.label', {
                      number: seatNumber + 1,
                      defaultValue: `Seat ${seatNumber + 1}`,
                    })
                    const isSittingOut = Boolean(player?.is_sitting_out_next_hand)
                    const isAllIn = Boolean(player?.is_all_in || (player?.stack ?? 0) <= 0)
                    const showHeroCards =
                      isHeroPlayer &&
                      heroCards.length > 0 &&
                      liveState.hand_id &&
                      liveState.status !== 'ended' &&
                      liveState.status !== 'waiting'
                    const showShowdownCards =
                      playerCards.length > 0 && (isInterHand || normalizedStatus === 'showdown')
                    const showOpponentBacks =
                      !isHeroPlayer &&
                      Boolean(player?.in_hand && liveState?.hand_id && !hasFolded && !showShowdownCards)
                    const isBottomSeat = slot.yPercent >= TABLE_CENTER_Y_APPROX
                    const lastActionSpacingClass = isBottomSeat ? 'mt-0.5' : ''
                    const seatHoleCards = showHeroCards
                      ? heroCards
                      : showShowdownCards
                        ? playerCards
                        : []
                    const showCardBacks = showOpponentBacks

                    return (
                      <Fragment key={`seat-${seatNumber}-${layoutIndex}`}>
                        <div
                          className={`absolute ${player ? 'seat-enter' : ''}`}
                          style={{
                            left: `${slot.xPercent}%`,
                            top: `${slot.yPercent}%`,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 25,
                          }}
                        >
                          <div
                            className="relative flex flex-col items-center gap-1.5"
                            onClick={!player && canJoin && !viewerIsSeated ? handleSeat : undefined}
                          >
                            <PlayerSeat
                              ref={playerKey ? (el: HTMLElement | null) => {
                                if (el) {
                                  playerTileRefs.current.set(playerKey, el)
                                } else {
                                  playerTileRefs.current.delete(playerKey)
                                }
                              } : undefined}
                              playerName={
                                player
                                  ? displayName
                                  : t('table.seat.empty', { defaultValue: 'Empty seat' })
                              }
                              chipCount={player?.stack ?? 0}
                              seatLabel={seatLabel}
                              positionLabel={positionLabel ?? null}
                              isHero={isHeroPlayer}
                              isActive={isActivePlayer}
                              hasFolded={hasFolded}
                              isSittingOut={isSittingOut}
                              isAllIn={isAllIn}
                              turnProgress={isActivePlayer ? turnProgress : null}
                              turnDeadline={isActivePlayer ? liveState?.action_deadline ?? null : null}
                              turnTotalSeconds={isActivePlayer ? liveState?.turn_timeout_seconds ?? null : null}
                              holeCards={seatHoleCards}
                              showCardBacks={showCardBacks}
                            />

                            {lastActionText && player?.in_hand && (
                              <p
                                className={`text-[9px] font-semibold uppercase tracking-wide text-emerald-200/90 ${lastActionSpacingClass}`}
                              >
                                {lastActionText}
                              </p>
                            )}
                          </div>
                        </div>

                      </Fragment>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md px-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
              <h2 className="mb-6 text-2xl font-bold text-white">
                {tableDetails.status === 'waiting' ? t('table.status.waiting') : t('table.status.loading')}
              </h2>

              <div className="mb-8">
                <p className="mb-4 text-sm text-white/70">
                  {t('table.meta.players')}: {tableDetails.player_count} / {tableMaxPlayers}
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

      {renderActionDock()}
    </div>
  </PokerFeltBackground>
  )
}
