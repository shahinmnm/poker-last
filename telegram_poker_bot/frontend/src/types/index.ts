export type GameVariant =
  | 'no_limit_texas_holdem'
  | 'no_limit_short_deck_holdem'
  | 'pot_limit_omaha_holdem'

export interface TableSummary {
  table_id: number
  table_name?: string | null
  status?: string
  small_blind?: number
  big_blind?: number
  player_count?: number
  max_players?: number
  is_public?: boolean
  is_private?: boolean
  is_persistent?: boolean
  game_variant?: GameVariant
}

export type { TableState, TablePlayerState, HandResultPayload } from './game'
