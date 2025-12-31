import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import clsx from 'clsx'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { useTableWebSocket } from '../legacy/hooks/useTableWebSocket'
import { useUserData } from '../providers/UserDataProvider'
import { useLayout } from '../providers/LayoutProvider'
import { apiFetch, ApiError } from '../utils/apiClient'
import { useUIMode } from '../hooks/useUIMode'
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
import PokerFeltBackground from '../components/background/PokerFeltBackground'
import TableMenuCapsule from '../components/table/TableMenuCapsule'
import CommunityBoard from '@/legacy/ui/table-legacy/table/CommunityBoard'
import ActionBar from '@/legacy/ui/table-legacy/table/ActionBar'
import DynamicPokerTable from '@/components/table/DynamicPokerTable'
import PlayerSeat from '@/legacy/ui/table-legacy/table/PlayerSeat'
import LeavingIndicator from '@/legacy/ui/table-legacy/table/LeavingIndicator'
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
  TurnContext,
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
const TABLE_CENTER_X_APPROX = 50
const TABLE_SIDE_THRESHOLD = 15  // X distance from center to classify as left/right side

/** Compute 4-directional side based on seat position relative to table center */
const getSeatSide = (xPercent: number, yPercent: number): 'top' | 'bottom' | 'left' | 'right' => {
  const isBottom = yPercent >= TABLE_CENTER_Y_APPROX
  const isLeft = xPercent < TABLE_CENTER_X_APPROX - TABLE_SIDE_THRESHOLD
  const isRight = xPercent > TABLE_CENTER_X_APPROX + TABLE_SIDE_THRESHOLD

  // Prioritize left/right for extreme positions, otherwise top/bottom
  if (isLeft) return 'left'
  if (isRight) return 'right'
  return isBottom ? 'bottom' : 'top'
}

const DEFAULT_TOAST = { message: '', visible: false }
const EXPIRED_TABLE_REDIRECT_DELAY_MS = 2000
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

const CARD_FIELD_KEYS = ['cards', 'hole_cards', 'hand_cards', 'hand', 'private_cards'] as const
type CardFieldKey = (typeof CARD_FIELD_KEYS)[number]
type CardCarrier = Partial<Record<CardFieldKey, string[]>>

const extractCardArray = (source: CardCarrier | null | undefined): string[] | null => {
  if (!source) return null
  for (const key of CARD_FIELD_KEYS) {
    const value = source[key]
    if (Array.isArray(value) && value.length) {
      return value
    }
  }
  return null
}

const mergeCardData = <T extends CardCarrier>(
  incoming: T | null | undefined,
  previous: CardCarrier | null | undefined,
  shouldPreserveCards: boolean,
  cachedCards?: string[] | null,
): T | null => {
  if (!incoming && !previous) return null

  const base = shouldPreserveCards
    ? { ...(previous ?? {}), ...(incoming ?? {}) }
    : incoming ?? null

  if (!base) return null

  const incomingCards = extractCardArray(incoming)
  const previousCards = extractCardArray(previous)
  const cardsToKeep = shouldPreserveCards
    ? incomingCards?.length
      ? incomingCards
      : previousCards?.length
        ? previousCards
        : cachedCards ?? null
    : incomingCards ?? null

  if (cardsToKeep?.length) {
    const keyToUse = CARD_FIELD_KEYS.find((key) => (base as CardCarrier)[key] !== undefined) ?? 'cards'
    return {
      ...(base as T),
      [keyToUse]: cardsToKeep,
    }
  }

  return base as T
}

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const { initData, user } = useTelegram()
  const { t } = useTranslation()
  const { refetchAll: refetchUserData } = useUserData()
  const { setShowBottomNav } = useLayout()
  const isTelegramAndroidWebView = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    const userAgent = navigator.userAgent || ''
    const isAndroid = /Android/i.test(userAgent)
    const telegramWebApp = window.Telegram?.WebApp
    const hasTelegramWebApp =
      telegramWebApp &&
      typeof telegramWebApp === 'object' &&
      typeof (telegramWebApp as { ready?: unknown }).ready === 'function'
    return isAndroid && hasTelegramWebApp
  }, [])

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
  const [interHandProgress, setInterHandProgress] = useState(1) // Progress for inter-hand countdown

  const [showTableExpiredModal, setShowTableExpiredModal] = useState(false)
  const [tableExpiredReason, setTableExpiredReason] = useState('')
  const [showVariantRules, setShowVariantRules] = useState(false)
  const [isTogglingSitOut, setIsTogglingSitOut] = useState(false)
  const [pendingSitOut, setPendingSitOut] = useState<boolean | null>(null)
  const variantConfig = useGameVariant(tableDetails?.game_variant)

  const autoTimeoutRef = useRef<{ handId: number | null; count: number }>({ handId: null, count: 0 })
  const autoActionTimerRef = useRef<number | null>(null)
  
  // TASK 3/4: Track in-flight action to prevent double-submission
  const [actionInFlight, setActionInFlight] = useState(false)
  const actionInFlightTimeoutRef = useRef<number | null>(null)
  
  // TASK 5: Track turn key for timer correctness and auto-action gating
  const lastTurnKeyRef = useRef<string>('')
  
  // Refs for tracking elements for animations
  const playerTileRefs = useRef<Map<string, HTMLElement>>(new Map())
  const potAreaRef = useRef<HTMLDivElement | null>(null)
  const lastActionRef = useRef<LastAction | null>(null)
  const lastHandResultRef = useRef<TableState['hand_result'] | null>(null)
  const lastCompletedHandIdRef = useRef<number | null>(null)
  const lastHandResultHandIdRef = useRef<number | null>(null)
  const heroCardsCacheRef = useRef<Map<number, string[]>>(new Map())
  const lastCachedHandIdRef = useRef<number | null>(null)
  const heroCardsRefreshRef = useRef<{ handId: number | null; attempts: number; lastAttemptAt: number }>({
    handId: null,
    attempts: 0,
    lastAttemptAt: 0,
  })
  
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
        const cardCacheHandId = incomingHandId ?? previousHandId

        if (!isSameHand) {
          heroCardsCacheRef.current.clear()
        }

        const mergedHero = mergeCardData<NonNullable<TableState['hero']>>(
          incoming.hero ?? null,
          previous?.hero ?? null,
          isSameHand,
          cardCacheHandId !== null ? heroCardsCacheRef.current.get(cardCacheHandId) : null,
        )
        const mergedHandResult = incoming.hand_result ?? (isSameHand ? previous?.hand_result ?? null : null)
        const mergedReadyPlayers =
          incoming.ready_players ?? (isSameHand ? previous?.ready_players ?? [] : [])
        const previousPlayers: TablePlayerState[] = previous?.players ?? []
        const incomingPlayers: TablePlayerState[] = incoming.players ?? []
        const mergedPlayers: TablePlayerState[] = incomingPlayers.length
          ? incomingPlayers.map((player) => {
              const previousMatch = isSameHand
                ? previousPlayers.find((p) => p.user_id?.toString() === player.user_id?.toString())
                : undefined
              return (
                mergeCardData<TablePlayerState>(
                  player,
                  previousMatch ?? null,
                  isSameHand,
                ) ?? player
              )
            })
          : previousPlayers.length
            ? previousPlayers.map((player) => {
                if (isSameHand) return player
                const sanitized = { ...player }
                CARD_FIELD_KEYS.forEach((key) => {
                  if (key in sanitized) {
                    delete (sanitized as Record<string, unknown>)[key]
                  }
                })
                return sanitized
              })
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
        const shouldPreserveAllowedActions =
          source === 'rest' &&
          lastSourceRef.current === 'ws' &&
          isSameHand &&
          Array.isArray(previous?.allowed_actions) &&
          previous.allowed_actions.length > 0 &&
          Array.isArray(incoming.allowed_actions) &&
          incoming.allowed_actions.length === 0
        const previousLegacyActions = (previous as any)?.allowed_actions_legacy
        const incomingLegacyActions = (incoming as any)?.allowed_actions_legacy
        const shouldPreserveAllowedActionsLegacy =
          source === 'rest' &&
          lastSourceRef.current === 'ws' &&
          isSameHand &&
          previousLegacyActions &&
          Object.keys(previousLegacyActions).length > 0 &&
          (!incomingLegacyActions || Object.keys(incomingLegacyActions).length === 0)

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
            shouldPreserveAllowedActions
              ? previous?.allowed_actions
              : mergedAllowedActions ??
                (isSameHand ? previous?.allowed_actions : undefined),
          allowed_actions_legacy:
            shouldPreserveAllowedActionsLegacy
              ? previous?.allowed_actions_legacy
              : mergedAllowedActionsLegacy ??
                (isSameHand ? previous?.allowed_actions_legacy : undefined),
        }

        const mergedHeroCards = extractCardArray(mergedHero)
        const cacheKey = nextState.hand_id ?? null
        if (cacheKey !== null) {
          if (mergedHeroCards?.length) {
            heroCardsCacheRef.current.set(cacheKey, mergedHeroCards)
          } else if (!isSameHand) {
            heroCardsCacheRef.current.delete(cacheKey)
          }
        } else {
          heroCardsCacheRef.current.clear()
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
  // Hero identity: trust server-provided hero/viewer first to stay aligned with PokerKit actor IDs; fall back to user.id only if absent.
  const heroId =
    liveState?.hero?.user_id ??
    tableDetails?.viewer?.user_id ??
    user?.id ??
    null
  const heroIdString = heroId !== null ? heroId.toString() : null
  const heroPlayer = liveState?.players.find((p) => p.user_id?.toString() === heroIdString) ?? null
  const heroIsStandingUp = pendingSitOut ?? Boolean(heroPlayer?.is_sitting_out_next_hand)

  useEffect(() => {
    if (pendingSitOut === null) return
    if (typeof heroPlayer?.is_sitting_out_next_hand === 'boolean' && heroPlayer.is_sitting_out_next_hand === pendingSitOut) {
      setPendingSitOut(null)
    }
  }, [heroPlayer?.is_sitting_out_next_hand, pendingSitOut])
  
  // Robust hero cards extraction with cached fallback to avoid losing visibility mid-hand
  const heroCards = useMemo(() => {
    const sources: Array<CardCarrier | null> = [
      liveState?.hero ?? null,
      heroPlayer,
      heroIdString
        ? liveState?.players.find((p) => p.user_id?.toString() === heroIdString) ?? null
        : null,
    ]

    for (const src of sources) {
      const cards = extractCardArray(src)
      if (cards) return cards
    }

    const handId = liveState?.hand_id ?? null
    if (handId !== null) {
      const cached = heroCardsCacheRef.current.get(handId)
      if (cached?.length) return cached
    }

    return []
  }, [heroIdString, heroPlayer, liveState?.hand_id, liveState?.hero, liveState?.players])
  useEffect(() => {
    const currentHandId = liveState?.hand_id ?? null

    if (currentHandId !== lastCachedHandIdRef.current) {
      heroCardsCacheRef.current.clear()
      lastCachedHandIdRef.current = currentHandId
    }

    if (currentHandId !== null && heroCards.length) {
      heroCardsCacheRef.current.set(currentHandId, heroCards)
    }
  }, [heroCards, liveState?.hand_id])
  const heroDisplayName =
    heroPlayer?.display_name ||
    heroPlayer?.username ||
    t('table.players.youTag', { defaultValue: 'You' })
  const heroStackAmount = heroPlayer?.stack ?? 0
  const heroSeatTags = useMemo(() => {
    const tags: string[] = []
    if (heroPlayer?.is_button) tags.push('D')
    if (heroPlayer?.is_big_blind) tags.push('BB')
    if (heroPlayer?.is_small_blind) tags.push('SB')
    return tags
  }, [heroPlayer?.is_big_blind, heroPlayer?.is_button, heroPlayer?.is_small_blind])
  const heroIsSittingOut = Boolean(heroPlayer?.is_sitting_out_next_hand && !heroPlayer?.in_hand)
  
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
  const opponentTag = useMemo(() => {
    if (!currentActorUserId || !heroIdString || currentActorUserId.toString() === heroIdString) return null
    const opponent = liveState?.players?.find((p) => p.user_id?.toString() === currentActorUserId.toString())
    return opponent?.display_name || opponent?.username || null
  }, [currentActorUserId, heroIdString, liveState?.players])
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
      // TASK 4: Network layer protection - check pre-conditions before any action
      if (!tableId || !initData) {
        showToast(t('table.errors.unauthorized'))
        return
      }

      const isReadyAction = actionType === 'ready'
      const normalizedActions = normalizeAllowedActions(liveState?.allowed_actions)
      
      // TASK 3/4: Prevent double-submission - check in-flight state
      if (actionInFlight) {
        if (import.meta.env.DEV) {
          console.debug('[Action] Blocked - already in flight:', { actionType })
        }
        return
      }

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
        // TASK 3: Hard gate - use turnContext for validation
        if (!isPlaying) {
          if (import.meta.env.DEV) {
            console.debug('[Action] Blocked - not in playing phase:', { actionType, phase: currentPhase })
          }
          showToast(t('table.errors.actionNotAllowed', { defaultValue: 'Action not available' }))
          return
        }
        if (!heroIdString || !currentActorUserId || currentActorUserId.toString() !== heroIdString) {
          if (import.meta.env.DEV) {
            console.debug('[Action] Blocked - not my turn:', { 
              actionType, 
              heroId: heroIdString, 
              actorId: currentActorUserId 
            })
          }
          showToast(t('table.errors.notYourTurn', { defaultValue: "It's not your turn" }))
          return
        }

        const isAllowed = normalizedActions.some((action) => action.action_type === actionType)
        if (!isAllowed) {
          if (import.meta.env.DEV) {
            console.debug('[Action] Blocked - action not in allowed list:', { 
              actionType, 
              allowed: normalizedActions.map(a => a.action_type) 
            })
          }
          showToast(t('table.errors.actionNotAllowed', { defaultValue: 'Action not available' }))
          return
        }
      }
      
      // DEV-only: Log action submission
      if (import.meta.env.DEV) {
        console.debug('[Action] Submitting:', { 
          actionType, 
          amount, 
          turnKey: `${tableId}:${liveState?.hand_id}:${currentActorUserId}`,
          allowed: normalizedActions.map(a => a.action_type),
        })
      }

      try {
        // TASK 3/4: Set in-flight immediately to prevent double-tap
        setActionInFlight(true)
        setActionPending(true)
        
        // TASK 4: Set timeout fallback to clear in-flight (DEV only uses shorter timeout)
        const inFlightTimeout = import.meta.env.DEV ? 5000 : 10000
        actionInFlightTimeoutRef.current = window.setTimeout(() => {
          if (import.meta.env.DEV) {
            console.debug('[Action] In-flight timeout reached, clearing flag')
          }
          setActionInFlight(false)
        }, inFlightTimeout)
        
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
        // Clear in-flight on error
        setActionInFlight(false)
        if (actionInFlightTimeoutRef.current) {
          clearTimeout(actionInFlightTimeoutRef.current)
          actionInFlightTimeoutRef.current = null
        }
      } finally {
        setActionPending(false)
        // Note: actionInFlight cleared by TurnKey change effect or timeout
        // We don't clear it here to prevent double-submission while waiting for WS update
      }
    },
    [
      actionInFlight,
      applyIncomingState,
      currentPhase,
      fetchLiveState,
      heroIdString,
      currentActorUserId,
      initData,
      isInterHand,
      isPlaying,
      liveState?.allowed_actions,
      liveState?.hand_id,
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

        // Handle player_sitout_changed: Update player's is_sitting_out_next_hand flag
        // This shows the "Leaving" badge for other players at the table
        if (payload?.type === 'player_sitout_changed') {
          const { user_id: sitoutUserId, is_sitting_out: isSittingOut } = payload
          if (sitoutUserId != null) {
            const sitoutUserIdStr = sitoutUserId.toString()
            setLiveState((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                players: prev.players.map((p) =>
                  p.user_id?.toString() === sitoutUserIdStr
                    ? { ...p, is_sitting_out_next_hand: isSittingOut }
                    : p
                ),
              }
            })
          }
          return
        }

        // Handle player_left with optimistic update to fix "Ghost Seat" bug
        if (payload?.type === 'player_left') {
          // Validate that user_id exists in the payload
          if (payload.user_id != null) {
            // Check if the current user is the one who left
            const leftUserId = payload.user_id.toString()
            const isCurrentUserLeft = heroIdString === leftUserId
            
            // 1. Optimistic Update: Remove player from liveState immediately
            setLiveState((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                players: prev.players.filter(p => p.user_id !== payload.user_id)
              };
            });
            
            // 2. If current user left, show toast and navigate to lobby
            if (isCurrentUserLeft) {
              const reason = payload.reason as string | undefined
              if (reason === 'left_after_hand') {
                showToast(t('table.toast.leftAfterHand', { defaultValue: 'You have left the table' }))
              } else {
                showToast(t('table.toast.left'))
              }
              // Navigate to lobby after a short delay to allow toast to be seen
              setTimeout(() => navigate('/lobby', { replace: true }), 1500)
              return
            }
          }
          
          // 3. Refresh full state from server
          fetchLiveState();
          return;
        }

        if (
          payload?.type === 'action' ||
          payload?.type === 'table_started' ||
          payload?.type === 'player_joined'
        ) {
          fetchTable()
        }
      },
      [applyIncomingState, fetchLiveState, fetchTable, heroIdString, liveState?.board, liveState?.hand_id, liveState?.hero, liveState?.inter_hand_wait_seconds, liveState?.min_raise, liveState?.players, liveState?.pot, liveState?.pots, liveState?.turn_timeout_seconds, navigate, showToast, tableId, t],
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
          const viewerId = heroIdString
          const viewerSeat = viewerId
            ? payload.players?.find((player) => player.user_id?.toString() === viewerId)
            : null
          const needsHeroRefresh =
            Boolean(viewerSeat) &&
            !viewerSeat?.is_sitting_out_next_hand &&
            !payload.hero?.cards?.length
          if (needsHeroRefresh && initDataRef.current) {
            // WebSocket payloads are public; refresh viewer-specific state for new hands.
            fetchLiveState()
          }
        }
      },
      [applyIncomingState, fetchLiveState, heroIdString, navigate, showToast, t],
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

  // Handle stand up toggle - calls the sitout API endpoint
  // When toggled on, player will leave their seat after the current hand ends
  const handleSitOutToggle = async (sitOut: boolean) => {
    if (!tableId || !initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    setPendingSitOut(sitOut)
    setIsTogglingSitOut(true)
    try {
      await apiFetch(`/tables/${tableId}/sitout`, {
        method: 'POST',
        initData,
        body: { sit_out: sitOut },
      })
      showToast(
        sitOut
          ? t('table.toast.standingUp', { defaultValue: 'You will stand up after this hand' })
          : t('table.toast.stayingSeated', { defaultValue: 'You will stay seated' })
      )
      // Refresh live state to get updated player data from server
      // Server state (heroPlayer.is_sitting_out_next_hand) is the source of truth
      fetchLiveState()
    } catch (err) {
      console.error('Error toggling stand up:', err)
      if (err instanceof ApiError) {
        const message =
          (typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : null) || t('table.errors.actionFailed')
        showToast(message)
      } else {
        showToast(t('table.errors.actionFailed'))
      }
      setPendingSitOut(null)
    }
    setIsTogglingSitOut(false)
  }

  const allowedActionsSource =
    liveState?.allowed_actions ?? liveState?.allowed_actions_legacy
  const allowedActions = normalizeAllowedActions(allowedActionsSource)
  const callAction = allowedActions.find((action) => action.action_type === 'call')
  const canCheckAction = allowedActions.some((action) => action.action_type === 'check')
  const canCheck = canCheckAction || (callAction?.amount ?? 0) === 0
  
  // TASK 2: Compute TurnContext - Single source of truth for action eligibility
  const turnContext = useMemo((): TurnContext => {
    const tableIdStr = tableId ?? ''
    const handIdVal = liveState?.hand_id ?? null
    const streetVal = liveState?.street ?? null
    const actorIdVal = currentActorUserId ?? null
    const myPlayerIdVal = heroIdString ?? null
    
    // Generate unique turn key for tracking
    const turnKey = `${tableIdStr}:${handIdVal ?? 'none'}:${actorIdVal ?? 'none'}`
    
    // Determine if it's my turn with strict validation
    const handNotEnded = liveState?.status !== 'showdown' && !isInterHand
    const actorKnown = actorIdVal !== null
    const myIdKnown = myPlayerIdVal !== null
    const idsMatch = actorKnown && myIdKnown && actorIdVal.toString() === myPlayerIdVal
    const isPlayingPhase = currentPhase === 'playing'
    
    // isMyTurn requires all conditions to be true
    const isMyTurn = isPlayingPhase && handNotEnded && idsMatch
    
    // Extract betting info from allowed actions
    // Note: raise and all_in are separate actions with different semantics
    const betAction = allowedActions.find(a => a.action_type === 'bet')
    const raiseAction = allowedActions.find(a => a.action_type === 'raise')
    // all_in is checked separately via allowedActions.some() below
    
    // For slider bounds, prefer raise action over all_in since all_in may not have min/max
    const sliderAction = betAction ?? raiseAction ?? null
    
    const toCall = callAction?.amount ?? 0
    const minRaise = sliderAction?.min_amount ?? 0
    const maxRaise = sliderAction?.max_amount ?? (heroPlayer?.stack ?? 0)
    const myStack = heroPlayer?.stack ?? 0
    
    // Parse action deadline
    let actionDeadlineMs: number | null = null
    if (liveState?.action_deadline) {
      const parsed = new Date(liveState.action_deadline).getTime()
      if (!isNaN(parsed)) {
        actionDeadlineMs = parsed
      }
    }
    
    // DEV-only: log TurnContext changes
    if (import.meta.env.DEV && turnKey !== lastTurnKeyRef.current) {
      console.debug('[TurnContext] Changed:', {
        turnKey,
        isMyTurn,
        actorId: actorIdVal,
        myPlayerId: myPlayerIdVal,
        handId: handIdVal,
        street: streetVal,
        phase: currentPhase,
        allowedActionsCount: allowedActions.length,
      })
    }
    
    return {
      tableId: tableIdStr,
      handId: handIdVal,
      street: streetVal,
      actorId: actorIdVal,
      myPlayerId: myPlayerIdVal,
      isMyTurn,
      turnKey,
      allowed: {
        canFold: isMyTurn && allowedActions.some(a => a.action_type === 'fold'),
        canCheck: isMyTurn && canCheckAction,
        canCall: isMyTurn && Boolean(callAction),
        canBet: isMyTurn && Boolean(betAction),
        canRaise: isMyTurn && Boolean(raiseAction),
        canAllIn: isMyTurn && allowedActions.some(a => a.action_type === 'all_in'),
      },
      toCall,
      minRaise,
      maxRaise,
      myStack,
      actionDeadlineMs,
      turnTimeoutSeconds: liveState?.turn_timeout_seconds ?? null,
    }
  }, [
    tableId,
    liveState?.hand_id,
    liveState?.street,
    liveState?.status,
    liveState?.action_deadline,
    liveState?.turn_timeout_seconds,
    currentActorUserId,
    heroIdString,
    heroPlayer?.stack,
    currentPhase,
    isInterHand,
    allowedActions,
    callAction,
    canCheckAction,
  ])
  
  const tableStatus = (liveState?.status ?? tableDetails?.status ?? '').toString().toLowerCase()
  const normalizedStatus = tableStatus
  const viewerIsCreator = tableDetails?.viewer?.is_creator ?? false
  const viewerIsSeated =
    tableDetails?.viewer?.is_seated ??
    Boolean(heroId && liveState?.players?.some((p) => p.user_id?.toString() === heroId.toString()))
  useEffect(() => {
    if (!viewerIsSeated && pendingSitOut !== null) {
      setPendingSitOut(null)
    }
  }, [viewerIsSeated, pendingSitOut])

  // Derive canStart from liveState for real-time responsiveness (per spec: must depend on WS liveState)
  const livePlayerCount = liveState?.players?.length ?? tableDetails?.player_count ?? 0
  const hasActiveHand = liveState?.hand_id !== null && liveState?.status !== 'waiting'
  const canStart =
    viewerIsCreator &&
    livePlayerCount >= 2 &&
    ((tableDetails?.status === 'waiting') || (tableDetails?.status === 'active' && !hasActiveHand))

  useEffect(() => {
    const handId = liveState?.hand_id ?? null

    if (!handId || !viewerIsSeated || heroIsStandingUp || isInterHand || !hasActiveHand) {
      heroCardsRefreshRef.current = { handId, attempts: 0, lastAttemptAt: 0 }
      return
    }

    if (heroCards.length > 0) {
      heroCardsRefreshRef.current = { handId, attempts: 0, lastAttemptAt: 0 }
      return
    }

    if (!initData) {
      return
    }

    const now = Date.now()
    const current = heroCardsRefreshRef.current
    const sameHand = current.handId === handId
    const attempts = sameHand ? current.attempts : 0
    const lastAttemptAt = sameHand ? current.lastAttemptAt : 0

    if (sameHand && attempts >= 2 && now - lastAttemptAt < 1500) {
      return
    }

    heroCardsRefreshRef.current = {
      handId,
      attempts: sameHand ? attempts + 1 : 1,
      lastAttemptAt: now,
    }

    const timeout = window.setTimeout(() => {
      fetchLiveState()
    }, 120)

    return () => window.clearTimeout(timeout)
  }, [
    fetchLiveState,
    hasActiveHand,
    heroCards.length,
    heroIsStandingUp,
    initData,
    isInterHand,
    liveState?.hand_id,
    viewerIsSeated,
  ])

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
  const potDisplayAmount = useMemo(() => {
    if (typeof liveState?.pot === 'number') return liveState.pot
    if (liveState?.pots?.length) {
      return liveState.pots.reduce((sum, pot) => sum + (pot.amount ?? 0), 0)
    }
    return 0
  }, [liveState?.pot, liveState?.pots])
  // Memoize winner display info to avoid find() on every render
  const winnerDisplayInfo = useMemo(() => {
    if (!lastHandResult?.winners?.length) return null
    const winner = lastHandResult.winners[0]
    const winnerPlayer = liveState?.players.find(p => p.user_id?.toString() === winner.user_id?.toString())
    return {
      amount: winner.amount,
      displayName: winnerPlayer?.display_name || winnerPlayer?.username || 'Player',
    }
  }, [lastHandResult?.winners, liveState?.players])
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

  // --- SEATING ENGINE LOGIC ---
  // Core principle: Hero-centric view where the current user always appears at the bottom-center.
  // For spectators, we use server index 0 as the anchor position.
  
  const MAX_SEATS = tableMaxPlayers || 9 // Default to 9 if unknown
  const heroServerIndex = heroPlayer?.seat ?? heroPlayer?.position ?? -1

  // 1. Calculate Rotation Offset
  // If Hero is seated, we rotate so Hero is at visual index 0 (Bottom).
  // If Spectator, we stick to absolute index 0 at Bottom.
  const rotationOffset = heroServerIndex !== -1 ? heroServerIndex : 0

  // 2. Generate Normalized Seat List (Fixed Size Array)
  // We create an array of exactly MAX_SEATS length to ensure visual stability.
  // This prevents players from "jumping around" when someone joins/leaves.
  interface NormalizedSeat {
    visualIndex: number      // 0 is always bottom-center (Hero position)
    serverIndex: number      // The actual server seat index
    playerData: TablePlayerState | null
    isHero: boolean
    isEmpty: boolean
  }

  const normalizedSeats = useMemo((): NormalizedSeat[] => {
    return Array.from({ length: MAX_SEATS }, (_, visualIndex) => {
      // Calculate which Server Seat belongs in this Visual Slot
      // Formula: ServerIndex = (VisualIndex + Offset) % Max
      const serverIndex = (visualIndex + rotationOffset) % MAX_SEATS
      
      // Find the player at this server index
      // Use Number() conversion to prevent string vs number mismatches from API
      const player = liveState?.players?.find(
        (p) => Number(p.seat ?? p.position) === serverIndex
      ) ?? null
      
      return {
        visualIndex,          // 0 is always bottom-center
        serverIndex,          // The actual server seat
        playerData: player,
        isHero: serverIndex === heroServerIndex && heroServerIndex !== -1,
        isEmpty: !player
      }
    })
  }, [MAX_SEATS, rotationOffset, liveState?.players, heroServerIndex])

  // 3. Determine which seats to actually render
  // For a cleaner UI, we only render occupied seats plus one empty seat for joining
  const seatsToRender = useMemo(() => {
    const occupiedSeats = normalizedSeats.filter(seat => !seat.isEmpty)
    
    // If viewer can join, find an empty seat to show as "take seat" option
    if (!viewerIsSeated && canJoin) {
      const emptySeat = normalizedSeats.find(seat => seat.isEmpty)
      if (emptySeat) {
        return [...occupiedSeats, emptySeat].sort((a, b) => a.visualIndex - b.visualIndex)
      }
    }
    
    // At minimum, show at least one seat
    if (occupiedSeats.length === 0) {
      return [normalizedSeats[0]]
    }
    
    return occupiedSeats
  }, [normalizedSeats, viewerIsSeated, canJoin])

  // 4. Get the seat layout configuration for the number of seats to render
  const seatLayout = useMemo(
    () => getSeatLayout(seatsToRender.length),
    [seatsToRender.length],
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
  
  // TASK 2: Use TurnContext for isMyTurn (single source of truth)
  const isMyTurn = turnContext.isMyTurn

  // PHASE 1: Compute UI mode for layout adjustments using useUIMode hook
  // This provides mode-based space allocation for board clarity
  const isShowdown = normalizedStatus === 'showdown'
  const isTableWaiting = normalizedStatus === 'waiting'
  const uiModeContext = useUIMode({
    isMyTurn,
    isShowdown,
    isInterHand,
    isTableWaiting,
    isSeated: viewerIsSeated,
    currentActorUserId,
  })
  const uiMode = uiModeContext.mode

  // TASK 5/6: Track TurnKey changes to reset in-flight state and cancel auto-actions
  useEffect(() => {
    const currentTurnKey = turnContext.turnKey
    const previousTurnKey = lastTurnKeyRef.current
    
    if (currentTurnKey !== previousTurnKey) {
      // TurnKey changed - reset in-flight state and clear pending auto-actions
      if (import.meta.env.DEV) {
        console.debug('[TurnKey] Changed:', {
          previous: previousTurnKey,
          current: currentTurnKey,
          isMyTurn: turnContext.isMyTurn,
        })
      }
      
      // Clear in-flight action state
      setActionInFlight(false)
      if (actionInFlightTimeoutRef.current) {
        clearTimeout(actionInFlightTimeoutRef.current)
        actionInFlightTimeoutRef.current = null
      }
      
      // Cancel pending auto-action timers
      if (autoActionTimerRef.current) {
        clearTimeout(autoActionTimerRef.current)
        autoActionTimerRef.current = null
        if (import.meta.env.DEV) {
          console.debug('[Timer] Cancelled auto-action timer on TurnKey change')
        }
      }
      
      lastTurnKeyRef.current = currentTurnKey
    }
  }, [turnContext.turnKey, turnContext.isMyTurn])

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

  // TASK 5: Auto-action timer with TurnKey validation
  useEffect(() => {
    // Always clear existing timer first
    if (autoActionTimerRef.current) {
      clearTimeout(autoActionTimerRef.current)
      autoActionTimerRef.current = null
    }

    // Don't start timer if not my turn or no deadline
    if (!turnContext.isMyTurn || !turnContext.actionDeadlineMs) {
      return undefined
    }
    
    // Capture current turn key for validation at execution time
    const executionTurnKey = turnContext.turnKey
    const handIdAtStart = liveState?.hand_id ?? null

    const delay = Math.max(0, turnContext.actionDeadlineMs - Date.now())
    
    if (import.meta.env.DEV) {
      console.debug('[Timer] Starting auto-action timer:', {
        turnKey: executionTurnKey,
        delayMs: delay,
        deadline: new Date(turnContext.actionDeadlineMs).toISOString(),
      })
    }

    const handleAutoAction = () => {
      // CRITICAL: Re-validate turn before executing auto-action
      // Check that the turn context hasn't changed since timer was set
      if (lastTurnKeyRef.current !== executionTurnKey) {
        if (import.meta.env.DEV) {
          console.debug('[Timer] Auto-action blocked - TurnKey changed:', {
            expected: executionTurnKey,
            current: lastTurnKeyRef.current,
          })
        }
        return
      }
      
      const timeoutCount =
        autoTimeoutRef.current.handId === handIdAtStart ? autoTimeoutRef.current.count : 0

      if (import.meta.env.DEV) {
        console.debug('[Timer] Executing auto-action:', {
          turnKey: executionTurnKey,
          canCheck,
          timeoutCount,
        })
      }

      if (timeoutCount === 0 && canCheck) {
        handleGameAction('check')
      } else {
        handleGameAction('fold')
      }

      autoTimeoutRef.current = {
        handId: handIdAtStart,
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
    turnContext.isMyTurn,
    turnContext.actionDeadlineMs,
    turnContext.turnKey,
    liveState?.hand_id,
  ])

  // Calculate inter-hand countdown progress
  useEffect(() => {
    if (!isInterHand || !liveState?.inter_hand_wait_deadline) {
      setInterHandProgress(1)
      return
    }

    const deadlineMs = new Date(liveState.inter_hand_wait_deadline).getTime()
    const totalMs = Math.max(1000, (liveState?.inter_hand_wait_seconds ?? 5) * 1000)

    const updateInterHandProgress = () => {
      const remaining = Math.max(0, deadlineMs - Date.now())
      const pct = Math.max(0, Math.min(1, remaining / totalMs))
      setInterHandProgress(pct)
    }

    updateInterHandProgress()
    const interval = window.setInterval(updateInterHandProgress, 100)
    return () => window.clearInterval(interval)
  }, [isInterHand, liveState?.inter_hand_wait_deadline, liveState?.inter_hand_wait_seconds])

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

  // TASK 6: Cleanup in-flight timeout ref on component unmount
  useEffect(() => {
    return () => {
      if (actionInFlightTimeoutRef.current) {
        clearTimeout(actionInFlightTimeoutRef.current)
        actionInFlightTimeoutRef.current = null
      }
      if (autoActionTimerRef.current) {
        clearTimeout(autoActionTimerRef.current)
        autoActionTimerRef.current = null
      }
    }
  }, [])

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
    const dockBaseClass = 'pointer-events-none fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2 px-4'
    const dockStyle = { paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }
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
      if (viewerIsSeated) {
        return (
          <div className={dockBaseClass} style={dockStyle}>
            <div className="w-full pointer-events-auto">
              <ActionBar
                allowedActions={allowedActions}
                onAction={handleGameAction}
                myStack={heroPlayer?.stack ?? 0}
                isProcessing={actionInFlight || loading || isTogglingSitOut}
                isMyTurn={false}
                onToggleStandUp={(next) => handleSitOutToggle(next)}
                isStandingUp={heroIsStandingUp}
                standUpProcessing={isTogglingSitOut}
                isShowdown={normalizedStatus === 'showdown'}
                isInterHand={isInterHand}
                heroName={heroDisplayName}
                heroStack={heroStackAmount}
                heroSeatTags={heroSeatTags}
                isHeroLeaving={heroIsStandingUp}
                isHeroSittingOut={heroIsSittingOut}
              />
            </div>
          </div>
        )
      }
      console.log('[Table ActionDock] Hidden: inter-hand phase')
      return null
    }

    // Logic for displaying the dock when table is active
    if (viewerIsSeated && tableStatus === 'active') {
      // Use TurnContext.isMyTurn as single source of truth
      return (
        <div className={dockBaseClass} style={dockStyle}>
          <div className="w-full pointer-events-auto">
            <ActionBar
              allowedActions={allowedActions}
              onAction={handleGameAction}
              myStack={heroPlayer?.stack ?? 0}
              isProcessing={actionInFlight || actionPending || loading || isTogglingSitOut}
              isMyTurn={turnContext.isMyTurn}
              onToggleStandUp={(next) => handleSitOutToggle(next)}
              isStandingUp={heroIsStandingUp}
              standUpProcessing={isTogglingSitOut}
              isShowdown={normalizedStatus === 'showdown'}
              isInterHand={isInterHand}
              heroName={heroDisplayName}
              heroStack={heroStackAmount}
              heroSeatTags={heroSeatTags}
              isHeroLeaving={heroIsStandingUp}
              isHeroSittingOut={heroIsSittingOut}
            />
          </div>
        </div>
      )
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
          <div className={dockBaseClass} style={dockStyle}>
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleStart}
                disabled={isStarting || !canStart}
                className="min-h-[48px] px-7 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 text-black font-bold text-base shadow-xl shadow-emerald-500/40 hover:from-emerald-400 hover:to-emerald-300 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isStarting ? t('table.actions.starting') : t('table.actions.start', { defaultValue: 'START GAME' })}
              </button>
            </div>
          </div>
        )
      }

      if (viewerIsSeated) {
        return (
          <div className={dockBaseClass} style={dockStyle}>
            <div className="pointer-events-auto rounded-full border border-white/10 bg-black/60 px-4 py-2 text-sm font-medium text-white/80 shadow-lg backdrop-blur-md">
              {t('table.messages.waitingForHost')}
            </div>
          </div>
        )
      }

      return null
    }

    // Active hand - show action controls when seated and hand is active
    // This handles gameplay streets (preflop, flop, turn, river)
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
        <div className={dockBaseClass} style={dockStyle}>
          <div className="w-full pointer-events-auto">
            <ActionBar
              allowedActions={allowedActions}
              onAction={handleGameAction}
              myStack={heroPlayer?.stack ?? 0}
              isProcessing={actionInFlight || actionPending || loading || isTogglingSitOut}
              isMyTurn={isMyTurn}
              onToggleStandUp={(next) => handleSitOutToggle(next)}
              isStandingUp={heroIsStandingUp}
              standUpProcessing={isTogglingSitOut}
              isShowdown={normalizedStatus === 'showdown'}
              isInterHand={isInterHand}
              heroName={heroDisplayName}
              heroStack={heroStackAmount}
              heroSeatTags={heroSeatTags}
              isHeroLeaving={heroIsStandingUp}
              isHeroSittingOut={heroIsSittingOut}
            />
          </div>
        </div>
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

      <div
        className={clsx('table-screen', isTelegramAndroidWebView && 'is-low-transparency')}
        data-ui-mode={uiMode}
      >
        {/* Back to Lobby Button (Top-Left) */}
        <div className="absolute top-14 left-4 z-50">
          <button 
            onClick={() => navigate('/lobby')}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white hover:bg-white/10 backdrop-blur-md border border-white/10 shadow-lg transition-all active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Arena - Game Content */}
        {liveState ? (
          <div className="flex flex-1 flex-col gap-3">
            <div className="relative flex-1">
              {/* Integrated Winner HUD & Next Hand Timer - Safe zone positioned below board */}
              {isInterHand && (
                <div 
                  className="board-cluster__winner absolute left-1/2 -translate-x-1/2 w-full max-w-md pointer-events-none flex flex-col items-center motion-reduce:transition-none"
                  style={{ 
                    top: 'calc(var(--streets-row-offset, 18vh) + var(--winner-banner-offset, 20vh))',
                    zIndex: 'var(--z-overlays, 40)'
                  }}
                >
                  {/* Winner Badge (Safe positioned below community cards) */}
                  {winnerDisplayInfo && (
                    <div className="winner-banner-safe winner-banner-safe--inline mb-4 motion-reduce:animate-none">
                      <div className="flex flex-col items-center">
                        {/* BETA HARDENING: tabular-nums applied via CSS (.winner-banner-safe__amount) */}
                        <span className="winner-banner-safe__amount">
                          {formatByCurrency(winnerDisplayInfo.amount, currencyType)} Chips
                        </span>
                        {/* BETA HARDENING: max-width + ellipsis applied via CSS (.winner-banner-safe__label) */}
                        <span className="winner-banner-safe__label" dir="auto">
                          Won by {winnerDisplayInfo.displayName}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Next Hand Progress Bar - respects reduced motion */}
                  <div className="w-48 bg-black/40 h-1.5 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                    <div 
                      className="h-full bg-emerald-400 shadow-[0_0_10px_currentColor] transition-all ease-linear motion-reduce:transition-none"
                      style={{ width: `${interHandProgress * 100}%`, transitionDuration: '100ms' }}
                    />
                  </div>
                </div>
              )}

              <div className="table-wrapper">
                <div
                  className="table-area table-bottom-padding relative"
                  style={{ '--seat-row-offset': viewerIsSeated ? '72vh' : '68vh' } as CSSProperties}
                >
                  <div className="table-oval" style={{ zIndex: 'var(--z-table-felt, 0)' }}>
                    <div className="absolute inset-0 rounded-[999px] bg-[radial-gradient(circle_at_30%_30%,_rgba(34,197,94,0.16)_0%,_rgba(6,78,59,0.65)_55%,_rgba(6,47,26,0.9)_100%)] shadow-[0_40px_120px_rgba(0,0,0,0.45)] ring-4 ring-emerald-500/35" />
                    <div className="absolute inset-[10px] rounded-[999px] border-[12px] border-emerald-200/35 shadow-inner shadow-emerald-900/50" />
                    <div className="absolute inset-[22px] rounded-[999px] bg-gradient-to-b from-white/15 via-transparent to-white/10 opacity-80" />
                  </div>

                  {tableDetails && (
                    <div 
                      className="table-header-capsule pointer-events-none" 
                      style={{ top: 'calc(env(safe-area-inset-top) + 12px)', zIndex: 60 }}
                    >
                      {/* Phase 3: Professional TableMenuCapsule with unified tokens */}
                      <TableMenuCapsule
                        tableName={templateRules.tableName ?? tableDetails.table_name ?? t('table.meta.defaultName', { defaultValue: 'Poker Table' })}
                        stakesDisplay={stakesDisplay}
                        connectionStatus={wsStatus === 'connected' ? 'connected' : wsStatus === 'connecting' ? 'connecting' : 'disconnected'}
                        onLeaveTable={handleLeave}
                        onRecentHands={() => setShowRecentHands(true)}
                        canLeave={canLeave}
                        isLeaving={isLeaving}
                        className="pointer-events-auto"
                      />
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

                  <div className="table-board-stack flex flex-col items-center gap-2 px-3 sm:px-4">
                    <CommunityBoard
                      potAmount={potDisplayAmount}
                      currencyType={currencyType}
                      cards={liveState.board ?? []}
                      highlightedCards={winningBoardCards}
                      potRef={potAreaRef}
                      opponentTag={opponentTag}
                    />
                    {liveState.hand_result && (
                      <div className="mt-0.5 flex justify-center">
                        <HandResultPanel liveState={liveState} currentUserId={heroId} />
                      </div>
                    )}
                  </div>

                  {seatLayout.map((slot, layoutIndex) => {
                    // Use the normalized seat data from seatsToRender
                    const normalizedSeat = seatsToRender[layoutIndex]
                    if (!normalizedSeat) return null
                    
                    const { serverIndex, playerData: player, isEmpty } = normalizedSeat
                    // Use String() conversion to prevent number vs string mismatches
                    const playerKey = player?.user_id?.toString() ?? null
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
                      number: serverIndex + 1,
                      defaultValue: `Seat ${serverIndex + 1}`,
                    })
                    const isSittingOut = Boolean(player?.is_sitting_out_next_hand)
                    const isAllIn = Boolean(player?.is_all_in || (player?.stack ?? 0) <= 0)
                    const showShowdownCards =
                      playerCards.length > 0 && (isInterHand || normalizedStatus === 'showdown')
                    const showOpponentBacks =
                      !isHeroPlayer &&
                      Boolean(player?.in_hand && liveState?.hand_id && !hasFolded && !showShowdownCards)
                    const heroSeatCards =
                      heroCards.length > 0
                        ? heroCards
                        : heroPlayer?.hole_cards?.length
                          ? heroPlayer.hole_cards
                          : heroPlayer?.cards ?? []
                    const seatSide = getSeatSide(slot.xPercent, slot.yPercent)
                    const isBottomSeat = seatSide === 'bottom'
                    const lastActionSpacingClass = isBottomSeat ? 'mt-0.5' : ''
                    const seatHoleCards = isHeroPlayer
                      ? heroSeatCards
                      : showShowdownCards
                        ? playerCards
                        : []
                    const showCardBacks = isHeroPlayer ? false : showOpponentBacks

                    return (
                      <Fragment key={`seat-server-${serverIndex}`}>
                        <div
                          className={`absolute ${player ? 'seat-enter' : ''}`}
                          style={{
                            left: `${slot.xPercent}%`,
                            top: `${slot.yPercent}%`,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 'var(--z-seats, 10)',
                          }}
                        >
                          <div
                            className="relative flex flex-col items-center gap-1.5"
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
                              turnDeadline={isActivePlayer ? liveState?.action_deadline ?? null : null}
                              turnTotalSeconds={isActivePlayer ? liveState?.turn_timeout_seconds ?? null : null}
                              holeCards={seatHoleCards}
                              showCardBacks={showCardBacks}
                              isEmpty={isEmpty}
                              onClick={isEmpty && canJoin && !viewerIsSeated ? handleSeat : undefined}
                              side={seatSide}
                              heroScaleReduced={isHeroPlayer && !isMyTurn}
                              seatIndex={serverIndex}
                            />

                            {/* Leaving Badge - Shows when player is leaving after this hand */}
                            {player && isSittingOut && (
                              <LeavingIndicator className="absolute -top-1.5 -right-1.5" />
                            )}

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
