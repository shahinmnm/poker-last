/**
 * useUIMode - State-aware UI mode hook for poker table layout
 *
 * Provides deterministic UI modes derived from existing game state:
 * - PLAYER_ACTION: Hero is the current actor
 * - OPPONENT_ACTION: Another player is acting
 * - SHOWDOWN: Hand result is visible or inter-hand wait
 * - WAITING: Table waiting for players or game start
 *
 * This hook does NOT add new backend state - it only derives from existing props.
 */

export type UIMode = 'PLAYER_ACTION' | 'OPPONENT_ACTION' | 'SHOWDOWN' | 'WAITING'

export interface UIModeContext {
  mode: UIMode
  isMyTurn: boolean
  isShowdown: boolean
  isInterHand: boolean
  isWaiting: boolean
  /** Scale factor for hero seat (1.0 = full, 0.85 = reduced during non-action) */
  heroSeatScale: number
  /** Whether ActionBar should be in minimal mode */
  actionBarMinimal: boolean
  /** Whether waiting toast should be shown */
  showWaitingToast: boolean
}

export interface UIModeParams {
  /** Is it currently the hero's turn to act */
  isMyTurn: boolean
  /** Is the hand in showdown or showing results */
  isShowdown: boolean
  /** Is it inter-hand waiting period */
  isInterHand: boolean
  /** Is the table waiting for players/start */
  isTableWaiting: boolean
  /** Is the viewer seated at the table */
  isSeated: boolean
  /** Current actor user ID (null if no active hand) */
  currentActorUserId: string | number | null
  /** Hero's user ID */
  heroUserId: string | number | null
}

/**
 * Compute UI mode from game state parameters
 */
export function computeUIMode(params: UIModeParams): UIModeContext {
  const {
    isMyTurn,
    isShowdown,
    isInterHand,
    isTableWaiting,
    isSeated,
    currentActorUserId,
    // heroUserId is available in params but not needed for mode computation
    // It's kept in the interface for potential future use
  } = params

  // Determine UI mode based on game state priority
  let mode: UIMode

  if (isTableWaiting || !isSeated) {
    mode = 'WAITING'
  } else if (isShowdown || isInterHand) {
    mode = 'SHOWDOWN'
  } else if (isMyTurn) {
    mode = 'PLAYER_ACTION'
  } else if (currentActorUserId !== null) {
    mode = 'OPPONENT_ACTION'
  } else {
    mode = 'WAITING'
  }

  // Derive layout adjustments from mode
  const heroSeatScale = mode === 'PLAYER_ACTION' ? 1.0 : 0.9
  const actionBarMinimal = mode !== 'PLAYER_ACTION'

  // Waiting toast logic: only show when NOT showdown AND NOT my turn
  // During showdown, suppress waiting UI entirely
  const showWaitingToast =
    mode === 'OPPONENT_ACTION' &&
    !isShowdown &&
    !isInterHand &&
    isSeated

  return {
    mode,
    isMyTurn,
    isShowdown,
    isInterHand,
    isWaiting: mode === 'WAITING',
    heroSeatScale,
    actionBarMinimal,
    showWaitingToast,
  }
}

/**
 * Hook to get current UI mode from game state
 * This is a pure derivation hook - no side effects
 */
export function useUIMode(params: UIModeParams): UIModeContext {
  return computeUIMode(params)
}

export default useUIMode
