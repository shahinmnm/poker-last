/**
 * Phase 5: Normalized Table State Types
 * 
 * These types represent the canonical, authoritative model for all table state.
 * All frontend rendering must use only these types, derived from backend payloads.
 * 
 * No legacy types. No inferred state. No client-side variant logic.
 */

// ============================================================================
// WebSocket Connection State
// ============================================================================

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'syncing_snapshot'
  | 'live'
  | 'version_mismatch'

// ============================================================================
// Core Table State (Authoritative Model)
// ============================================================================

export interface NormalizedTableState {
  // Variant and game flow
  variant_id: string
  current_street: string | null
  round_number: number | null // for draw & triple-draw
  
  // Board state
  community_cards: Card[]
  max_cards_per_player: number
  
  // Seat map with stable indices
  seat_map: Seat[]
  
  // Action state
  legal_actions: LegalAction[]
  action_deadline: number | null // epoch ms
  
  // Pot state
  pots: Pot[]
  
  // Table metadata
  table_metadata: TableMetadata
  
  // Draw game specific
  discard_phase_active?: boolean
  discard_limits?: {
    min: number
    max: number
  }
  
  // Hand result (only at showdown)
  hand_result?: HandResult | null
  
  // Schema versioning for desync detection
  schema_version?: string
  table_version?: number
  event_seq?: number
}

// ============================================================================
// Card Types
// ============================================================================

export interface Card {
  rank?: string // "A", "K", "Q", "J", "T", "9", etc.
  suit?: string // "s", "h", "d", "c"
  hidden?: boolean // If true, rank/suit are omitted
  face_up?: boolean // For stud/board games
}

export type CardCode = string // "As", "Kh", "Tc", "XX" (hidden)

// ============================================================================
// Seat and Player
// ============================================================================

export interface Seat {
  seat_index: number
  user_id: number | string | null
  display_name: string | null
  avatar_url: string | null
  stack_amount: number
  current_bet: number
  is_acting: boolean
  is_sitting_out: boolean
  is_winner: boolean
  is_button: boolean
  
  // Hole cards
  expected_hole_card_count: number
  hole_cards: Card[] // With hidden:true for other players
  
  // Stud/board games
  face_up_cards?: Card[]
  face_down_cards?: Card[] // Always hidden for others
  
  // Additional flags
  is_all_in?: boolean
  is_small_blind?: boolean
  is_big_blind?: boolean
}

// ============================================================================
// Legal Actions
// ============================================================================

export interface LegalAction {
  action: ActionType
  min_amount?: number
  max_amount?: number
  call_amount?: number
  min_raise_amount?: number
  
  // Action presets (optional)
  presets?: ActionPreset[]
}

export type ActionType =
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'all_in'
  | 'discard'
  | 'stand_pat'
  | 'ready'

export interface ActionPreset {
  label: string // "½ Pot", "Pot", "Min Raise"
  amount: number
}

export type BettingStructure = 'NL' | 'PL' | 'FL'

// ============================================================================
// Pot
// ============================================================================

export interface Pot {
  pot_index: number
  amount: number
  eligible_user_ids: Array<number | string>
}

// ============================================================================
// Table Metadata
// ============================================================================

export interface TableMetadata {
  table_id: number
  name: string
  stakes: string
  variant: string
  template_id: number
  currency: string
  table_type: TableType
  buyin_limits?: {
    min: number
    max: number
  }
  rake?: number
  turn_timeout: number // seconds
  uptime?: number // seconds since creation
  expiration?: number | null // epoch ms
  betting_structure: BettingStructure
}

export type TableType = 'public' | 'private' | 'persistent' | 'sng'

// ============================================================================
// Hand Result (Showdown)
// ============================================================================

export interface HandResult {
  winners: WinnerInfo[]
  showdown_hands?: ShowdownHand[]
  rake_amount?: number
  total_pot?: number
}

export interface WinnerInfo {
  user_id: number | string
  amount: number
  pot_index?: number
  hand_rank?: string
  best_hand_cards?: Card[]
  description?: string
  rake_deducted?: number
  
  // Omaha/Hi-Lo specific
  best_hand_indices_high?: number[]
  best_hand_indices_low?: number[]
}

export interface ShowdownHand {
  user_id: number | string
  cards: Card[]
  hand_rank?: string
  best_hand_cards?: Card[]
}

// ============================================================================
// Discard Action (Draw Games)
// ============================================================================

export interface DiscardAction {
  discard_phase_active: boolean
  discard_limits: {
    min: number
    max: number
  }
  selected_cards?: CardCode[] // Client-side tracking
}

// ============================================================================
// WebSocket Messages
// ============================================================================

export interface TableDeltaMessage {
  type: 'table_update' | 'seat_update' | 'player_update' | 'pot_update' | 'action_update' | 'timer_update' | 'snapshot'
  schema_version: string
  table_version: number
  event_seq: number
  payload: Partial<NormalizedTableState> | NormalizedTableState
  timestamp?: number // epoch ms
}

export interface WebSocketMessage {
  type: string
  [key: string]: any
}

export interface HeartbeatMessage {
  type: 'ping' | 'pong'
}

// ============================================================================
// Lobby
// ============================================================================

export interface LobbyEntry {
  table_id: number
  template_name: string
  variant: string
  stakes: string
  player_count: number
  max_players: number
  waitlist_count?: number
  uptime?: number // seconds
  expiration?: number | null // epoch ms
  table_type: TableType
  invite_only?: boolean
}

export interface LobbyDeltaMessage {
  type: 'lobby_update' | 'table_added' | 'table_removed'
  payload: LobbyEntry | { table_id: number }
}

// ============================================================================
// Variant Capabilities (per variant)
// ============================================================================

export interface VariantCapabilities {
  variant_id: string
  has_community_cards: boolean
  has_draw_rounds: boolean
  has_face_up_cards: boolean // Stud games
  max_draw_rounds?: number
  max_hole_cards?: number
  supports_hi_lo?: boolean
}

// ============================================================================
// Animation Events
// ============================================================================

export type AnimationType =
  | 'card_slide'
  | 'card_flip'
  | 'bet_movement'
  | 'pot_collection'
  | 'win_highlight'
  | 'timeout_pulse'

export interface AnimationEvent {
  id: string
  type: AnimationType
  target: string // seat_index or element ID
  duration: number // ms
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  cards?: CardCode[]
  amount?: number
  cancelled?: boolean
}
