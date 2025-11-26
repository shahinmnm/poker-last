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
import { apiFetch, ApiError } from '../utils/apiClient'

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

      const allowedActions =
        gameState.allowed_actions && !Array.isArray(gameState.allowed_actions)
          ? gameState.allowed_actions
          : undefined

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
    [gameState, t]
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

  // Derive useful state for UI (memoized for performance)
  const derivedState = useMemo(() => {
    const heroId = gameState?.hero?.user_id ?? null
    const heroPlayer = gameState?.players.find((p) => p.user_id === heroId)
    const amountToCall = Math.max((gameState?.current_bet ?? 0) - (heroPlayer?.bet ?? 0), 0)
    const isMyTurn = gameState?.current_actor === heroId
    const allowedActions =
      gameState?.allowed_actions && !Array.isArray(gameState.allowed_actions)
        ? gameState.allowed_actions
        : undefined

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
  }, [gameState])

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
