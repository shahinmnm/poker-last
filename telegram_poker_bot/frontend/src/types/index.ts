export type GameVariant =
  | 'no_limit_texas_holdem'
  | 'no_limit_short_deck_holdem'
  | 'pot_limit_omaha_holdem'
  | 'pot_limit_omaha'
  | 'five_card_draw'
  | 'triple_draw_2_7_lowball'
  | 'badugi'

export interface TemplateLayout {
  type: 'ring' | 'oval' | 'double-board'
  seat_count: number
  radius: number
  avatar_size: number
  card_scale: number
}

export interface TemplateTheme {
  table_color: string
  felt_pattern: string
  accent_color: string
  ui_color_mode: 'light' | 'dark'
}

export interface TemplateTimers {
  avatar_ring: boolean
  ring_color: string
  ring_thickness: number
}

export interface TemplateIcons {
  table_icon: string
  stake_label: string
  variant_badge: string
}

export interface TemplateRulesDisplay {
  show_blinds: boolean
  show_speed: boolean
  show_buyin: boolean
}

export interface TemplateUISchema {
  layout: TemplateLayout
  theme: TemplateTheme
  timers: TemplateTimers
  icons: TemplateIcons
  rules_display: TemplateRulesDisplay
}

export interface TableTemplateConfig {
  backend: Record<string, any>
  ui_schema: TemplateUISchema
}

export interface TableTemplateInfo {
  id: number | string
  name?: string
  table_type: string
  config_json: TableTemplateConfig
  config?: Record<string, any>
  has_waitlist?: boolean
  is_active?: boolean
  variant_config?: VariantConfig
}

export interface VariantConfig {
  hole_cards_count?: number // 2 for Hold'em, 4 for Omaha, 5 for Draw
  community_cards?: boolean // true for Hold'em/Omaha, false for Draw
  draw_rounds?: number // Number of draw rounds (e.g., 3 for Triple Draw)
  discard_enabled?: boolean // Whether discarding is allowed
  max_discards_per_round?: number // Maximum cards to discard per round
  board_cards_to_use?: number // For Omaha: must use exactly 2 from hand
  lowball?: boolean // For lowball variants
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
  waitlist?: WaitlistInfo
}

export interface WaitlistInfo {
  count: number
  positions: WaitlistPosition[]
}

export interface WaitlistPosition {
  user_id: number
  position: number
  joined_at: string
  display_name?: string | null
  username?: string | null
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

// Admin Table Detail types
export interface AdminTableDetail {
  table_id: number
  table_name?: string | null
  status: string
  phase?: string
  game_variant?: GameVariant
  player_count: number
  max_players: number
  current_hand_id?: number | null
  hand_number?: number | null
  is_persistent?: boolean
  template?: TableTemplateInfo | null
  waitlist?: WaitlistInfo
  session_metrics?: SessionMetrics
  state_summary?: TableStateSummary
  created_at?: string
  updated_at?: string
  last_action_at?: string
}

export interface SessionMetrics {
  total_hands_played: number
  total_pot_amount: number
  avg_pot_size: number
  active_duration_minutes: number
  players_joined_total: number
  players_left_total: number
}

export interface TableStateSummary {
  current_pot: number
  current_bet: number
  players_in_hand: number
  players_all_in: number
  street?: string | null
  board_cards?: string[]
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
