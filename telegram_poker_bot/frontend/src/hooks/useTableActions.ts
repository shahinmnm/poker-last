/**
 * useTableActions - Centralized betting logic hook
 * 
 * Encapsulates all betting logic and validation for poker table actions.
 * Handles BigInt conversion and API communication.
 * 
 * @example
 * const { onFold, onCheck, onCall, onBet, validateBetAmount } = useTableActions({
 *   tableId: '123',
 *   currentUser: user,
 *   gameState: liveState,
 * })
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch, ApiError } from '../utils/apiClient'

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
  last_action?: {
    user_id: number
    action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | string
    amount?: number | null
    street?: string | null
    created_at?: string | null
  } | null
  hand_result?: {
    winners: Array<{
      user_id: number
      amount: number
      pot_index: number
      hand_score: number
      hand_rank: string
      best_hand_cards: string[]
    }>
  } | null
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

interface UseTableActionsProps {
  /** Table ID */
  tableId: string
  /** Current game state from WebSocket */
  gameState: LiveTableState | null
  /** Telegram init data for authentication */
  initData?: string | null
  /** Callback when action succeeds */
  onActionSuccess?: (state: LiveTableState) => void
  /** Callback when action fails */
  onActionError?: (message: string) => void
}

interface ValidationResult {
  isValid: boolean
  error?: string
}

export function useTableActions({
  tableId,
  gameState,
  initData,
  onActionSuccess,
  onActionError,
}: UseTableActionsProps) {
  const { t } = useTranslation()

  /**
   * Validate bet amount against min/max constraints
   * 
   * @param amount - Amount in smallest units (cents)
   * @returns Validation result with error message if invalid
   */
  const validateBetAmount = useCallback(
    (amount: number): ValidationResult => {
      if (!gameState) {
        return { isValid: false, error: t('table.errors.noGameState') }
      }

      const heroId = gameState.hero?.user_id
      const heroPlayer = gameState.players.find((p) => p.user_id === heroId)

      if (!heroPlayer) {
        return { isValid: false, error: t('table.errors.playerNotFound') }
      }

      const minRaise = gameState.allowed_actions?.min_raise_to || gameState.min_raise
      const maxRaise =
        gameState.allowed_actions?.max_raise_to || heroPlayer.stack + heroPlayer.bet

      if (amount < minRaise) {
        return {
          isValid: false,
          error: t('table.errors.belowMinimum', { min: minRaise }),
        }
      }

      if (amount > maxRaise) {
        return {
          isValid: false,
          error: t('table.errors.aboveMaximum', { max: maxRaise }),
        }
      }

      return { isValid: true }
    },
    [gameState, t]
  )

  /**
   * Internal function to send action to API
   */
  const sendAction = useCallback(
    async (
      actionType: 'fold' | 'check' | 'call' | 'bet' | 'raise',
      amount?: number
    ): Promise<void> => {
      if (!tableId || !initData) {
        const message = t('table.errors.unauthorized')
        onActionError?.(message)
        throw new Error(message)
      }

      try {
        const state = await apiFetch<LiveTableState>(`/tables/${tableId}/actions`, {
          method: 'POST',
          initData,
          body: {
            action_type: actionType,
            amount,
          },
        })

        onActionSuccess?.(state)
      } catch (err) {
        console.error('Error sending action', err)
        const message =
          err instanceof ApiError &&
          typeof err.data === 'object' &&
          err.data &&
          'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : t('table.errors.actionFailed')

        onActionError?.(message)
        throw err
      }
    },
    [tableId, initData, onActionSuccess, onActionError, t]
  )

  /**
   * Fold action - discard hand
   */
  const onFold = useCallback(async () => {
    return sendAction('fold')
  }, [sendAction])

  /**
   * Check action - no bet required
   */
  const onCheck = useCallback(async () => {
    return sendAction('check')
  }, [sendAction])

  /**
   * Call action - match current bet
   */
  const onCall = useCallback(async () => {
    return sendAction('call')
  }, [sendAction])

  /**
   * Bet action with amount validation
   * 
   * @param amount - Amount in smallest units (cents). If user inputs "20.5" in UI,
   *                 it should be converted to 2050 before calling this function.
   */
  const onBet = useCallback(
    async (amount: number) => {
      const validation = validateBetAmount(amount)
      if (!validation.isValid) {
        const message = validation.error || t('table.errors.invalidAmount')
        onActionError?.(message)
        throw new Error(message)
      }
      return sendAction('bet', amount)
    },
    [sendAction, validateBetAmount, onActionError, t]
  )

  /**
   * Raise action with amount validation
   * 
   * @param amount - Amount in smallest units (cents). If user inputs "20.5" in UI,
   *                 it should be converted to 2050 before calling this function.
   */
  const onRaise = useCallback(
    async (amount: number) => {
      const validation = validateBetAmount(amount)
      if (!validation.isValid) {
        const message = validation.error || t('table.errors.invalidAmount')
        onActionError?.(message)
        throw new Error(message)
      }
      return sendAction('raise', amount)
    },
    [sendAction, validateBetAmount, onActionError, t]
  )

  // Derive useful state for UI
  const heroId = gameState?.hero?.user_id ?? null
  const heroPlayer = gameState?.players.find((p) => p.user_id === heroId)
  const amountToCall = Math.max((gameState?.current_bet ?? 0) - (heroPlayer?.bet ?? 0), 0)
  const isMyTurn = gameState?.current_actor === heroId
  const canCheck = amountToCall === 0 || Boolean(gameState?.allowed_actions?.can_check)
  const canBet = amountToCall === 0 && Boolean(gameState?.allowed_actions?.can_bet)
  const canRaise = amountToCall > 0 && Boolean(gameState?.allowed_actions?.can_raise)
  const minRaise = gameState?.allowed_actions?.min_raise_to || gameState?.min_raise || 0
  const maxRaise =
    gameState?.allowed_actions?.max_raise_to ||
    (heroPlayer ? heroPlayer.stack + heroPlayer.bet : 0)
  const currentPot = gameState?.allowed_actions?.current_pot || gameState?.pot || 0

  return {
    // Actions
    onFold,
    onCheck,
    onCall,
    onBet,
    onRaise,
    
    // Validation
    validateBetAmount,
    
    // State
    isMyTurn,
    canCheck,
    canBet,
    canRaise,
    amountToCall,
    minRaise,
    maxRaise,
    currentPot,
    heroPlayer,
  }
}
