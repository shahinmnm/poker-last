/**
 * @deprecated This file contains legacy game state types.
 * New code should use the normalized types from '../types/normalized.ts'.
 * This file is kept for compatibility with existing legacy code only.
 *
 * SEMANTICS CONTRACT (bet/raise amounts):
 * - call_amount / amount (for call action): INCREMENTAL - chips to add to match current bet
 * - min_amount / max_amount (for raise/bet actions): TOTAL-TO - total committed for the street
 * - UI should display "Call {call_amount}" (incremental) and "Raise to {amount}" (total)
 */

import type { CurrencyType } from '../utils/currency'

export type TableStatus =
  | 'waiting'
  | 'preflop'
  | 'flop'
  | 'turn'
  | 'river'
  | 'showdown'
  | 'INTER_HAND_WAIT'
  | string

export type AllowedActionType =
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'all_in'
  | 'ready'
  | 'discard'
  | 'stand_pat'

export interface AllowedAction {
  action_type: AllowedActionType
  /**
   * For 'call' action: INCREMENTAL amount (chips to add to match current bet)
   * For 'bet'/'raise': not used (use min_amount/max_amount instead)
   */
  amount?: number
  /**
   * For 'bet'/'raise' actions: minimum TOTAL-TO amount (total committed for street)
   * Display as "Raise to {min_amount}" not "Raise by {min_amount}"
   */
  min_amount?: number
  /**
   * For 'bet'/'raise' actions: maximum TOTAL-TO amount (total committed for street)
   * This is typically player's stack + current bet
   */
  max_amount?: number
  cards_to_discard?: string[] // For draw games
  max_discards?: number // Maximum cards that can be discarded
}

export type AllowedActionsPayload =
  | AllowedAction[]
  | {
      can_fold?: boolean
      can_check?: boolean
      can_call?: boolean
      /**
       * INCREMENTAL: amount to add to match current bet
       * Display as "Call {call_amount}"
       */
      call_amount?: number
      can_bet?: boolean
      can_raise?: boolean
      can_all_in?: boolean
      /**
       * TOTAL-TO: minimum total committed for street
       * Display as "Raise to {min_raise_to}" not "Raise by"
       */
      min_raise_to?: number
      /**
       * TOTAL-TO: maximum total committed for street
       */
      max_raise_to?: number
      current_pot?: number
      player_stack?: number
      ready?: boolean
    }

export interface TablePlayerState {
  user_id: number | string
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
  is_all_in?: boolean
  cards?: string[]
  hole_cards?: string[]
  flags?: string[]
  is_ready?: boolean
}

export interface HeroState {
  user_id: number | string
  cards: string[]
}

export interface HandWinnerResult {
  user_id: number | string
  amount: number
  pot_index?: number
  hand_score?: number
  hand_rank?: string
  best_hand_cards?: string[]
  cards?: string[]
  description?: string
  rake_deducted?: number
}

export interface ShowdownHand {
  user_id: number | string
  cards: string[]
  hand_rank?: string
  best_hand_cards?: string[]
  amount?: number
}

export interface HandResultPayload {
  winners: HandWinnerResult[]
  showdown_hands?: ShowdownHand[]
  hands?: ShowdownHand[]
  players?: ShowdownHand[]
  rake_amount?: number
  total_pot?: number
}

export interface TablePot {
  pot_index?: number
  amount: number
  eligible_user_ids?: Array<number | string>
  player_ids?: Array<number | string>
}

export interface TableState {
  type: 'table_state'
  table_id: number
  hand_id: number | null
  status: TableStatus
  phase?: 'waiting' | 'playing' | 'inter_hand_wait' | 'finished' | 'destroying'
  table_status?: string
  street: string | null
  board: string[]
  pot: number
  currency_type?: CurrencyType
  pots?: TablePot[]
  current_bet: number
  min_raise: number
  current_actor: number | string | null
  current_actor_user_id?: number | string | null
  action_deadline?: string | null
  turn_timeout_seconds?: number
  players: TablePlayerState[]
  hero: HeroState | null
  last_action?: {
    user_id: number | string
    action: AllowedActionType | string
    amount?: number | null
    street?: string | null
    created_at?: string | null
    cards_discarded?: string[] // For draw games
  } | null
  hand_result?: HandResultPayload | null
  inter_hand_wait?: boolean
  inter_hand_wait_seconds?: number
  inter_hand_wait_deadline?: string | null
  inter_hand?: {
    hand_no: number | null
    ready_count: number
    min_players: number
    ready_players: Array<number | string>
    can_ready?: boolean
    players: Array<{
      user_id: number | string
      is_ready: boolean
      is_sitting_out_next_hand?: boolean
      display_name?: string | null
    }>
  } | null
  allowed_actions?: AllowedActionsPayload
  allowed_actions_legacy?: AllowedActionsPayload
  ready_players?: Array<number | string>
  // Variant-specific fields
  draw_round?: number // Current draw round (1, 2, 3 for Triple Draw)
  max_draw_rounds?: number // Total draw rounds for this variant
  variant?: string // Game variant identifier
}

/**
 * TurnContext: Single source of truth for action eligibility.
 * Used to gate UI actions and prevent double-submissions.
 */
export interface TurnContext {
  tableId: string
  handId?: string | number | null
  street?: string | null
  actorId?: string | number | null
  myPlayerId?: string | number | null
  isMyTurn: boolean
  /** Unique key for turn tracking: `${tableId}:${handId}:${actorId}` */
  turnKey: string
  allowed: {
    canFold: boolean
    canCheck: boolean
    canCall: boolean
    canBet: boolean
    canRaise: boolean
    canAllIn: boolean
  }
  toCall?: number       // chips needed to call
  minRaise?: number
  maxRaise?: number
  myStack?: number
  /** Server-provided action deadline (epoch ms) */
  actionDeadlineMs?: number | null
  /** Turn timeout in seconds from server */
  turnTimeoutSeconds?: number | null
}
