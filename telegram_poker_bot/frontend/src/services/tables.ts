import { apiFetch, type ApiFetchOptions } from '../utils/apiClient'
import type { GameVariant, TableTemplateInfo } from '@/types'

export type TableVisibility = 'public' | 'private'

export interface CreateTableOptions {
  templateId: number
  visibility?: TableVisibility
  autoSeatHost?: boolean
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
  visibility?: TableVisibility | string
  is_public?: boolean
  is_private?: boolean
  creator_user_id?: number | null
  game_variant?: GameVariant
  is_persistent?: boolean
  viewer?: TableViewerState | null
  host?: TableHostInfo | null
  invite?: TableInviteInfo | null
  created_at?: string | null
  updated_at?: string | null
  template?: TableTemplateInfo | null
}

export async function createTable(
  options: CreateTableOptions,
  initData?: string | null,
): Promise<TableSummary> {
  const body = {
    template_id: options.templateId,
    auto_seat_host: options.autoSeatHost,
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
