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

import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { TableState } from '@/types/game'
import { apiFetch, ApiError } from '../../utils/apiClient'

interface UseTableActionsProps {
  /** Table ID */
  tableId: string
  /** Current game state from WebSocket */
  gameState: TableState | null
  /** Telegram init data for authentication */
  initData?: string | null
  /** Callback when action succeeds */
  onActionSuccess?: (state: TableState) => void
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

  const parseAllowedActions = useCallback(
    (payload?: TableState['allowed_actions']) => {
      if (!payload) return undefined
      if (!Array.isArray(payload)) return payload

      const derived: {
        can_fold?: boolean
        can_check?: boolean
        can_call?: boolean
        call_amount?: number
        can_bet?: boolean
        can_raise?: boolean
        can_all_in?: boolean
        min_raise_to?: number
        max_raise_to?: number
        ready?: boolean
        current_pot?: number
        player_stack?: number
      } = {}

      payload.forEach((action) => {
        const amount = action.amount ?? action.min_amount ?? 0
        const maxAmount = action.max_amount ?? amount

        switch (action.action_type) {
          case 'fold':
            derived.can_fold = true
            break
          case 'check':
            derived.can_check = true
            break
          case 'call':
            derived.can_call = true
            derived.call_amount = amount
            break
          case 'bet':
            derived.can_bet = true
            derived.min_raise_to = action.min_amount ?? amount
            derived.max_raise_to = action.max_amount ?? amount
            break
          case 'raise':
            derived.can_raise = true
            derived.min_raise_to = action.min_amount ?? derived.min_raise_to ?? amount
            derived.max_raise_to = action.max_amount ?? derived.max_raise_to ?? maxAmount
            break
          case 'all_in':
            derived.can_all_in = true
            derived.max_raise_to = maxAmount
            derived.min_raise_to = action.min_amount ?? amount
            break
          case 'ready':
            derived.ready = true
            break
        }
      })

      // Preserve numeric helpers if already provided in legacy payload
      derived.current_pot =
        (gameState as any)?.allowed_actions?.current_pot ??
        derived.current_pot
      derived.player_stack =
        (gameState as any)?.allowed_actions?.player_stack ??
        derived.player_stack

      return derived
    },
    [gameState]
  )

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

      const allowedActions = parseAllowedActions(gameState.allowed_actions)

      const minRaise = allowedActions?.min_raise_to ?? gameState.min_raise
      const maxRaise = allowedActions?.max_raise_to ?? heroPlayer.stack + heroPlayer.bet

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
    [gameState, parseAllowedActions, t]
  )

  /**
   * Internal function to send action to API
   */
  const sendAction = useCallback(
    async (
      actionType: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | 'ready',
      amount?: number
    ): Promise<void> => {
      if (!tableId || !initData) {
        const message = t('table.errors.unauthorized')
        onActionError?.(message)
        throw new Error(message)
      }

      try {
        const state = await apiFetch<TableState>(`/tables/${tableId}/actions`, {
          method: 'POST',
          initData,
          body: {
            action_type: actionType,
            amount,
          },
        })

        onActionSuccess?.(state)
      } catch (err: unknown) {
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

  // Derive useful state for UI (memoized for performance)
  const derivedState = useMemo(() => {
    const heroId = gameState?.hero?.user_id ?? null
    const heroPlayer = gameState?.players.find((p) => p.user_id === heroId)
    const amountToCall = Math.max((gameState?.current_bet ?? 0) - (heroPlayer?.bet ?? 0), 0)
    const isMyTurn = gameState?.current_actor === heroId
    const allowedActions = parseAllowedActions(gameState?.allowed_actions)

    const canCheck = amountToCall === 0 || Boolean(allowedActions?.can_check)
    const canBet = amountToCall === 0 && Boolean(allowedActions?.can_bet)
    const canRaise = amountToCall > 0 && Boolean(allowedActions?.can_raise)
    const minRaise = allowedActions?.min_raise_to || gameState?.min_raise || 0
    const maxRaise =
      allowedActions?.max_raise_to || (heroPlayer ? heroPlayer.stack + heroPlayer.bet : 0)
    const currentPot = allowedActions?.current_pot || gameState?.pot || 0

    return {
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
  }, [gameState, parseAllowedActions])

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
    ...derivedState,
  }
}
