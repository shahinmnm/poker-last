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

export interface TableInfo {
  table_id: number
  mode: string
  status: string
  player_count: number
  max_players: number
  small_blind: number
  big_blind: number
  table_name: string | null
  host?: TableHostInfo | null
  created_at?: string | null
  updated_at?: string | null
  starting_stack?: number
  is_full?: boolean
  is_private?: boolean
  is_public?: boolean
  visibility?: 'public' | 'private'
  viewer?: TableViewerState | null
  creator_user_id?: number | null
}

export interface ActiveTable extends TableInfo {
  starting_stack: number
  viewer?: TableViewerState | null
}
