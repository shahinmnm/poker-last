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

// Analytics types

export interface TableSnapshot {
  id: number
  table_id: number
  snapshot_time: string
  player_count: number
  is_active: boolean
  metadata?: Record<string, any>
}

export interface TableSnapshotsResponse {
  table_id: number
  snapshots: TableSnapshot[]
  count: number
}

export interface HourlyTableStats {
  id: number
  table_id: number
  hour_start: string
  avg_players: number
  max_players: number
  total_hands: number
  activity_minutes: number
  metadata?: Record<string, any>
}

export interface HourlyStatsResponse {
  table_id: number
  hourly_stats: HourlyTableStats[]
  count: number
}

export interface RecentSnapshotsResponse {
  snapshots: TableSnapshot[]
  count: number
}

export interface RecentHourlyStatsResponse {
  hourly_stats: HourlyTableStats[]
  count: number
}

export type { TableState, TablePlayerState, HandResultPayload } from './game'
