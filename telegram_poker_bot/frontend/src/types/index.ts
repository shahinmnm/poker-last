export type GameVariant =
  | 'no_limit_texas_holdem'
  | 'no_limit_short_deck_holdem'
  | 'pot_limit_omaha_holdem'

export interface TableTemplateInfo {
  id: number | string
  table_type: string
  config: Record<string, any>
  has_waitlist?: boolean
}

export interface TableSummary {
  table_id: number
  table_name?: string | null
  status?: string
  player_count?: number
  max_players?: number
  is_public?: boolean
  is_private?: boolean
  is_persistent?: boolean
  game_variant?: GameVariant
  currency_type?: string
  template?: TableTemplateInfo | null
  created_at?: string | null
  updated_at?: string | null
  expires_at?: string | null
  visibility?: string
}

export type { TableState, TablePlayerState, HandResultPayload } from './game'
