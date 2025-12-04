/**
 * TypeScript interfaces for Phase 3 Advanced Analytics API
 * 
 * Generated for frontend consumption with React Query integration.
 */

// ==================== Common Types ====================

export type AlertType = 'big_pot' | 'timeout_surge' | 'vpip_mismatch' | 'rapid_action';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'open' | 'reviewed' | 'dismissed';
export type LeaderboardType = 'daily' | 'weekly' | 'monthly' | 'alltime';

// ==================== Real-Time Metrics ====================

export interface ActionsHistogram {
  bet?: number;
  raise?: number;
  call?: number;
  fold?: number;
  check?: number;
}

export interface AggressionMetrics {
  af: number;
  afq: number;
  bets: number;
  raises: number;
  calls: number;
  folds: number;
}

export interface RecentPotStats {
  count: number;
  avg: number;
  min: number;
  max: number;
}

export interface TableLiveMetrics {
  hand_count: number;
  pot_sum: number;
  active_seats: number;
  waitlist_count: number;
  actions_histogram: ActionsHistogram;
  aggression_metrics: AggressionMetrics;
  recent_pot_stats: RecentPotStats;
  showdown_frequency: number;
  turn_time_p95: number;
}

export interface TableLiveMetricsResponse {
  table_id: number;
  timestamp: string;
  metrics: TableLiveMetrics;
}

export interface AllTablesLiveMetricsResponse {
  timestamp: string;
  count: number;
  tables: Array<{
    table_id: number;
    status: string;
    metrics: TableLiveMetrics;
  }>;
}

// ==================== Table Analytics ====================

export interface HourlyTableStat {
  hour_start: string;
  avg_players: number;
  max_players: number;
  total_hands: number;
  activity_minutes: number;
  metadata: Record<string, any>;
}

export interface TableStatsSummary {
  total_hands: number;
  avg_pot: number;
  max_pot: number;
  total_rake: number;
  multiway_freq: number;
  showdown_freq: number;
}

export interface TableStatsResponse {
  table_id: number;
  period: {
    start: string;
    end: string;
    hours: number;
  };
  hourly_stats: HourlyTableStat[];
  summary: TableStatsSummary;
}

// ==================== Player Analytics ====================

export interface HourlyPlayerStat {
  hour_start: string;
  hands_played: number;
  net_profit: number;
  vpip_count: number;
  pfr_count: number;
}

export interface PlayerSession {
  session_id: number;
  table_id: number;
  session_start: string;
  session_end: string | null;
  buy_in: number;
  cash_out: number | null;
  net: number | null;
  hands_played: number;
}

export interface PlayerStatsSummary {
  total_hands: number;
  total_sessions: number;
  net_profit: number;
  total_rake: number;
  vpip_pct: number;
  pfr_pct: number;
  af: number | null;
}

export interface PlayerStatsResponse {
  user_id: number;
  username: string | null;
  period: {
    start: string;
    end: string;
    hours: number;
  };
  summary: PlayerStatsSummary;
  hourly_stats: HourlyPlayerStat[];
  recent_sessions: PlayerSession[];
}

// ==================== User Profile Analytics ====================

export interface VariantBreakdown {
  [variant: string]: {
    hands: number;
    profit: number;
  };
}

export interface UserStatsResponse {
  user_id: number;
  period: {
    start: string;
    end: string;
    hours: number;
  };
  summary: {
    total_hands: number;
    net_profit: number;
    total_rake: number;
    vpip_pct: number;
    pfr_pct: number;
    af: number | null;
  };
  variant_breakdown: VariantBreakdown;
  hourly_stats: Array<{
    hour_start: string;
    hands_played: number;
    net_profit: number;
    vpip_pct: number;
    pfr_pct: number;
  }>;
}

export interface HandSummary {
  hand_id: number;
  table_id: number;
  hand_no: number;
  variant: string;
  stakes: string;
  players_in_hand: number;
  total_pot: number;
  my_net: number | null;
  went_to_showdown: boolean;
  multiway: boolean;
  created_at: string;
}

export interface UserHandsResponse {
  count: number;
  hands: HandSummary[];
}

export interface UserSessionSummary {
  session_id: number;
  table_id: number;
  session_start: string;
  session_end: string | null;
  duration_minutes: number | null;
  buy_in: number;
  cash_out: number | null;
  net: number | null;
  hands_played: number;
  vpip_pct: number;
  pfr_pct: number;
}

export interface UserSessionsResponse {
  count: number;
  sessions: UserSessionSummary[];
}

// ==================== Anomaly Alerts ====================

export interface AnomalyAlert {
  id: number;
  alert_type: AlertType;
  severity: AlertSeverity;
  table_id: number | null;
  user_id: number | null;
  hand_id: number | null;
  message: string;
  metadata: Record<string, any>;
  status: AlertStatus;
  created_at: string;
  reviewed_at: string | null;
}

export interface AnomaliesResponse {
  count: number;
  alerts: AnomalyAlert[];
}

export interface ReviewAnomalyRequest {
  new_status: 'reviewed' | 'dismissed';
}

export interface ReviewAnomalyResponse {
  alert_id: number;
  new_status: string;
  reviewed_at: string;
}

export interface ScanAnomaliesResponse {
  scanned_at: string;
  alerts_created: number;
  alerts: Array<{
    id: number;
    alert_type: AlertType;
    severity: AlertSeverity;
    table_id: number | null;
    message: string;
  }>;
}

// ==================== Leaderboards ====================

export interface LeaderboardRanking {
  rank: number;
  username: string;
  score: number;
  hands: number;
}

export interface LeaderboardResponse {
  leaderboard_type: LeaderboardType;
  variant: string | null;
  snapshot_time: string | null;
  rankings: LeaderboardRanking[];
}

export interface MyLeaderboardRankResponse {
  leaderboard_type: LeaderboardType;
  variant: string | null;
  my_rank: number | null;
  my_score: number | null;
  nearby: Array<{
    rank: number;
    username: string;
    score: number;
    is_me: boolean;
  }>;
}

// ==================== WebSocket Events ====================

export interface WSTableMetricsUpdate {
  type: 'table_metrics_update';
  table_id: number;
  metrics: TableLiveMetrics;
  timestamp: string;
}

export interface WSAnomalyAlert {
  type: 'anomaly_alert';
  alert: AnomalyAlert;
  timestamp: string;
}

export interface WSPotSpikeAlert {
  type: 'pot_spike_alert';
  table_id: number;
  hand_id: number;
  pot_size: number;
  timestamp: string;
}

export interface WSTimeoutSurgeAlert {
  type: 'timeout_surge_alert';
  table_id: number;
  user_id: number;
  timeout_count: number;
  timestamp: string;
}

export type WSAnalyticsEvent =
  | WSTableMetricsUpdate
  | WSAnomalyAlert
  | WSPotSpikeAlert
  | WSTimeoutSurgeAlert;

// ==================== API Request Params ====================

export interface GetTableStatsParams {
  table_id: number;
  hours?: number; // Default: 24
}

export interface GetPlayerStatsParams {
  user_id: number;
  hours?: number; // Default: 168
}

export interface GetMyStatsParams {
  hours?: number; // Default: 168
}

export interface GetMyHandsParams {
  limit?: number; // Default: 50, max: 200
  offset?: number; // Default: 0
  variant?: string;
}

export interface GetMySessionsParams {
  limit?: number; // Default: 20, max: 100
  offset?: number; // Default: 0
}

export interface GetAnomaliesParams {
  alert_type?: AlertType;
  severity?: AlertSeverity;
  status?: AlertStatus; // Default: 'open'
  limit?: number; // Default: 100, max: 500
}

export interface GetLeaderboardsParams {
  leaderboard_type?: LeaderboardType; // Default: 'daily'
  variant?: string;
}

export interface ScanAnomaliesParams {
  table_id?: number;
}

// ==================== React Query Hook Types ====================

export interface UseTableLiveMetricsOptions {
  table_id: number;
  refetchInterval?: number; // Default: 5000 (5 seconds)
}

export interface UsePlayerStatsOptions extends GetPlayerStatsParams {
  enabled?: boolean;
}

export interface UseMyStatsOptions extends GetMyStatsParams {
  enabled?: boolean;
}

export interface UseAnomaliesOptions extends GetAnomaliesParams {
  enabled?: boolean;
  refetchInterval?: number;
}

// ==================== Heatmap Data Types ====================

export interface PositionalStealFrequency {
  position: string; // 'BTN', 'CO', 'MP', 'EP'
  steal_frequency: number;
  total_opportunities: number;
}

export interface CBetHeatmap {
  position: string;
  street: 'flop' | 'turn' | 'river';
  cbet_frequency: number;
  fold_to_cbet_frequency: number;
  total_opportunities: number;
}

export interface PositionalWinrate {
  position: string;
  hands_played: number;
  net_profit: number;
  bb_per_100: number;
}

export interface HeatmapsResponse {
  steal_by_position: PositionalStealFrequency[];
  cbet_heatmap: CBetHeatmap[];
  positional_winrate: PositionalWinrate[];
}
