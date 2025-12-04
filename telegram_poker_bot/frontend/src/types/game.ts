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
  amount?: number
  min_amount?: number
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
      call_amount?: number
      can_bet?: boolean
      can_raise?: boolean
      can_all_in?: boolean
      min_raise_to?: number
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
