import type { GameVariant } from '@/types'

export type TableStatusTone = 'running' | 'waiting' | 'finished'

export interface TableHostInfo {
  user_id: number
  username?: string | null
  display_name?: string | null
}

export interface TableViewerState {
  is_seated?: boolean
  seat_position?: number | null
  chips?: number | null
  joined_at?: string | null
  is_creator?: boolean
}

export interface TableTemplateInfo {
  id: number | string
  table_type: string
  has_waitlist?: boolean
  config: Record<string, any>
}

export interface TableInfo {
  table_id: number
  mode: string
  status: string
  player_count: number
  max_players: number
  table_name: string | null
  host?: TableHostInfo | null
  created_at?: string | null
  updated_at?: string | null
  expires_at?: string | null
  starting_stack?: number
  is_full?: boolean
  is_private?: boolean
  is_public?: boolean
  visibility?: 'public' | 'private'
  viewer?: TableViewerState | null
  creator_user_id?: number | null
  template?: TableTemplateInfo | null
  currency_type?: string
  is_persistent?: boolean
  game_variant?: GameVariant
}

export interface ActiveTable extends TableInfo {
  starting_stack?: number
  viewer?: TableViewerState | null
}
