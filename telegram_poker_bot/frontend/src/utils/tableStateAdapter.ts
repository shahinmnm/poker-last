import type { TableState, AllowedActionsPayload, TablePot, TablePlayerState } from '../types/game'
import type { NormalizedTableState, Seat, Card, CardCode, LegalAction, ActionType } from '../types/normalized'

const toCard = (code: CardCode | Card | undefined): Card => {
  if (!code) return { hidden: true }
  if (typeof code === 'object') return code as Card
  const str = String(code)
  if (str.length < 2) return { rank: str, suit: undefined }
  const rank = str.slice(0, -1)
  const suit = str.slice(-1)
  return { rank, suit }
}

const mapAllowedActions = (rawAllowed?: AllowedActionsPayload): LegalAction[] => {
  if (!rawAllowed) return []

  if (Array.isArray(rawAllowed)) {
    return rawAllowed.map((a) => ({
      action: ((a as any).action_type || (a as any).action || 'fold') as ActionType,
      min_amount: (a as any).min_amount,
      max_amount: (a as any).max_amount,
      call_amount: (a as any).amount ?? (a as any).call_amount,
      min_raise_amount: (a as any).min_raise_amount ?? (a as any).min_raise_to,
    }))
  }

  const actions: LegalAction[] = []
  if (rawAllowed.can_fold) actions.push({ action: 'fold' })
  if (rawAllowed.can_check) actions.push({ action: 'check' })
  if (rawAllowed.can_call) actions.push({ action: 'call', call_amount: rawAllowed.call_amount })
  if (rawAllowed.can_bet) actions.push({ action: 'bet', min_amount: rawAllowed.min_raise_to, max_amount: rawAllowed.max_raise_to })
  if (rawAllowed.can_raise) actions.push({ action: 'raise', min_amount: rawAllowed.min_raise_to, max_amount: rawAllowed.max_raise_to })
  if (rawAllowed.can_all_in) actions.push({ action: 'all_in' })
  if (rawAllowed.ready) actions.push({ action: 'ready' })

  return actions
}

const getSeatNumber = (player: Partial<TablePlayerState> | undefined): number | null => {
  if (!player) return null
  const idx = (player as any).position ?? (player as any).seat
  const num = typeof idx === 'string' ? Number(idx) : idx
  return Number.isFinite(num) ? (num as number) : null
}

const buildSeat = (
  player: Partial<TablePlayerState> | undefined,
  seatIndex: number,
  actingUserId: number | string | null | undefined,
  maxCardsPerPlayer: number,
): Seat => {
  if (!player) {
    return {
      seat_index: seatIndex,
      user_id: null,
      display_name: null,
      avatar_url: null,
      stack_amount: 0,
      current_bet: 0,
      is_acting: false,
      is_sitting_out: false,
      is_winner: false,
      is_button: false,
      is_small_blind: false,
      is_big_blind: false,
      expected_hole_card_count: 0,
      hole_cards: [],
    }
  }

  const cards = player.cards || player.hole_cards || []
  const seatNum = getSeatNumber(player) ?? seatIndex
  return {
    seat_index: seatNum,
    user_id: player.user_id ?? null,
    display_name: player.display_name || player.username || null,
    avatar_url: (player as any).avatar_url ?? null,
    stack_amount: player.stack ?? 0,
    current_bet: player.bet ?? 0,
    is_acting: actingUserId != null && player.user_id === actingUserId,
    is_sitting_out: player.is_sitting_out_next_hand ?? false,
    is_winner: false,
    is_button: player.is_button ?? false,
    is_small_blind: player.is_small_blind ?? false,
    is_big_blind: player.is_big_blind ?? false,
    expected_hole_card_count: cards.length || maxCardsPerPlayer,
    hole_cards: Array.isArray(cards) ? cards.map(toCard) : [],
    face_up_cards: undefined,
    face_down_cards: undefined,
    is_all_in: player.is_all_in ?? false,
  }
}

export function normalizeTableState(rawInput: TableState | any): NormalizedTableState {
  const raw = rawInput || {}
  const rawPlayers: Array<Partial<TablePlayerState>> = Array.isArray(raw.players) ? raw.players : []
  const actingUserId = raw.current_actor_user_id ?? raw.current_actor ?? null
  const maxSeats = Number.isFinite(raw.max_players) ? Number(raw.max_players) : Math.max(rawPlayers.length, 9)

  const maxCardsPerPlayer =
    raw.max_cards_per_player ??
    rawPlayers.reduce((max, p) => Math.max(max, (p.cards?.length || p.hole_cards?.length || 0)), 0) ||
    2

  const seat_map: Seat[] = []
  for (let i = 0; i < maxSeats; i++) {
    const matching = rawPlayers.find((p) => getSeatNumber(p) === i)
    if (matching) {
      seat_map.push(buildSeat(matching, i, actingUserId, maxCardsPerPlayer))
    } else {
      seat_map.push(buildSeat(undefined, i, actingUserId, maxCardsPerPlayer))
    }
  }

  const community_cards: Card[] = Array.isArray(raw.board) ? raw.board.map(toCard) : []

  const pots: NormalizedTableState['pots'] = Array.isArray(raw.pots)
    ? (raw.pots as TablePot[]).map((p, idx) => ({
        pot_index: p.pot_index ?? idx,
        amount: p.amount ?? 0,
        eligible_user_ids: p.eligible_user_ids || p.player_ids || [],
      }))
    : raw.pot
      ? [{ pot_index: 0, amount: raw.pot, eligible_user_ids: [] }]
      : []

  const legal_actions = mapAllowedActions(raw.allowed_actions || raw.allowed_actions_legacy)

  const stakes =
    raw.stakes ||
    (raw.small_blind && raw.big_blind ? `${raw.small_blind}/${raw.big_blind}` : '10/20')

  const templateId = Number(raw.template?.id ?? raw.template_id ?? 0) || 0
  const tableType = (raw.template?.table_type || raw.table_type || 'public') as any

  const table_metadata: NormalizedTableState['table_metadata'] = {
    table_id: raw.table_id ?? 0,
    name: raw.table_name || 'Table',
    stakes,
    variant: raw.game_variant || raw.variant || 'no_limit_texas_holdem',
    template_id: templateId,
    currency: raw.currency_type || 'PLAY',
    table_type: tableType,
    buyin_limits:
      raw.buy_in_min !== undefined && raw.buy_in_max !== undefined
        ? { min: Number(raw.buy_in_min), max: Number(raw.buy_in_max) }
        : undefined,
    rake: raw.rake,
    turn_timeout: Number(raw.turn_timeout_seconds ?? 30) || 30,
    uptime: raw.uptime,
    expiration: raw.expiration ?? (raw.expires_at ? new Date(raw.expires_at).getTime() : undefined),
    betting_structure: (raw.betting_structure as any) || 'NL',
  }

  const actingSeat =
    actingUserId != null
      ? seat_map.find((s) => s.user_id === actingUserId)?.seat_index ?? null
      : null

  return {
    variant_id: table_metadata.variant,
    current_street: raw.street ?? raw.status ?? null,
    round_number: raw.draw_round ?? raw.max_draw_rounds ?? null,
    community_cards,
    max_cards_per_player: maxCardsPerPlayer,
    seat_map,
    acting_seat_id: actingSeat,
    legal_actions,
    action_deadline: raw.action_deadline ? new Date(raw.action_deadline).getTime() : null,
    pots,
    table_metadata,
    discard_phase_active: raw.inter_hand_wait ?? false,
    discard_limits: undefined,
    hand_result: null,
    schema_version: raw.schema_version,
    table_version: raw.table_version,
    event_seq: raw.event_seq,
  }
}
