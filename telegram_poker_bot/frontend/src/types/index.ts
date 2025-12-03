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

// Admin Analytics types

export type InsightType =
  | 'unusual_activity'
  | 'high_traffic'
  | 'low_traffic'
  | 'waitlist_surge'
  | 'inactivity_pattern'
  | 'rapid_player_change'

export type InsightSeverity = 'info' | 'warning' | 'critical'

export interface Insight {
  type: InsightType
  severity: InsightSeverity
  title: string
  message: string
  table_id?: number
  metadata?: Record<string, any>
  timestamp: string
}

export interface RealtimeAnalyticsResponse {
  timestamp: string
  snapshots: Array<{
    table_id: number
    snapshot_time: string
    player_count: number
    is_active: boolean
    metadata: Record<string, any>
  }>
  count: number
}

export interface HourlyAggregatesResponse {
  period: {
    start: string
    end: string
    hours: number
  }
  hourly_stats: Array<{
    table_id: number
    hour_start: string
    avg_players: number
    max_players: number
    total_hands: number
    activity_minutes: number
    metadata: Record<string, any>
  }>
  count: number
}

export interface HistoricalRangeResponse {
  metric_type: 'hourly' | 'snapshot'
  period: {
    start: string
    end: string
  }
  data: Array<Record<string, any>>
  count: number
}

export interface AnalyticsSummaryResponse {
  timestamp: string
  tables: {
    by_status: Record<string, number>
    total: number
  }
  analytics: {
    total_snapshots: number
    total_hourly_stats: number
    latest_snapshot_time?: string
    latest_hourly_time?: string
  }
}

export interface InsightsResponse {
  timestamp: string
  analysis_period_hours: number
  insights: Insight[]
  count: number
  by_type: {
    unusual_activity: number
    high_traffic: number
    low_traffic: number
    waitlist_surge: number
    inactivity_pattern: number
    rapid_player_change: number
  }
  by_severity: {
    info: number
    warning: number
    critical: number
  }
}

export interface InsightsDeliveryResponse {
  timestamp: string
  insights_generated: number
  delivery_results: Record<string, boolean>
  insights: Insight[]
}

export type { TableState, TablePlayerState, HandResultPayload } from './game'
