import { apiFetch, type ApiFetchOptions } from '../utils/apiClient'

export type TableVisibility = 'public' | 'private'

export interface CreateTableOptions {
  tableName?: string
  smallBlind: number
  bigBlind: number
  startingStack: number
  maxPlayers: number
  visibility: TableVisibility
  autoSeatHost?: boolean
  gameVariant?: 'no_limit_texas_holdem' | 'no_limit_short_deck_holdem'
}

export interface TableViewerState {
  user_id?: number
  is_creator?: boolean
  is_seated?: boolean
  seat_position?: number | null
  chips?: number | null
  joined_at?: string | null
}

export interface TableHostInfo {
  user_id: number
  username?: string | null
  display_name?: string | null
}

export interface TableInviteInfo {
  game_id?: string
  status?: string
  expires_at?: string | null
}

export interface TableSummary {
  table_id: number
  table_name: string | null
  mode?: string
  status?: string
  player_count?: number
  max_players?: number
  small_blind?: number
  big_blind?: number
  starting_stack?: number
  visibility?: TableVisibility | string
  is_public?: boolean
  is_private?: boolean
  creator_user_id?: number | null
  game_variant?: string
  is_persistent?: boolean
  viewer?: TableViewerState | null
  host?: TableHostInfo | null
  invite?: TableInviteInfo | null
  created_at?: string | null
  updated_at?: string | null
}

export async function createTable(
  options: CreateTableOptions,
  initData?: string | null,
): Promise<TableSummary> {
  const body = {
    table_name: options.tableName,
    small_blind: options.smallBlind,
    big_blind: options.bigBlind,
    starting_stack: options.startingStack,
    max_players: options.maxPlayers,
    visibility: options.visibility,
    auto_seat_host: options.autoSeatHost,
    game_variant: options.gameVariant,
  }

  const requestOptions: ApiFetchOptions = {
    method: 'POST',
    body,
  }

  if (initData) {
    requestOptions.initData = initData
  }

  const response = await apiFetch<TableSummary>('/tables', requestOptions)
  return response
}
