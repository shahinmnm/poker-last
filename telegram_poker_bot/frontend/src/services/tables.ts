import { apiFetch, type ApiFetchOptions } from '../utils/apiClient'
import type { GameVariant, TableTemplateInfo } from '@/types'

export type TableVisibility = 'public' | 'private'

export interface CreateTableOptions {
  templateId: string
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

export interface TableTemplateQueryParams {
  table_type?: string
  variant?: string
  has_waitlist?: boolean
  page?: number
  per_page?: number
}

export interface TableTemplateListResponse {
  templates: TableTemplateInfo[]
  page?: number
  per_page?: number
  total?: number
}

export interface TableTemplatePayload {
  name: string
  table_type: string
  has_waitlist?: boolean
  is_active?: boolean
  config_json: Record<string, any>
  [key: string]: any
}

export interface TableTemplateUpdatePayload {
  name?: string
  table_type?: string
  has_waitlist?: boolean
  is_active?: boolean
  config_json?: Record<string, any>
  [key: string]: any
}

function normalizeTemplateInfo(template: any): TableTemplateInfo {
  const config_json =
    template?.config_json ??
    (template?.config
      ? { backend: template.config, ui_schema: template.ui_schema ?? {} }
      : { backend: {}, ui_schema: {} })

  return {
    ...template,
    config_json,
    config: config_json?.backend ?? template?.config ?? {},
  }
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

export async function getTableTemplates(
  params: TableTemplateQueryParams = {},
): Promise<TableTemplateListResponse> {
  const searchParams = new URLSearchParams()
  if (params.table_type) searchParams.set('table_type', params.table_type)
  if (params.variant) searchParams.set('variant', params.variant)
  if (params.has_waitlist !== undefined) {
    searchParams.set('has_waitlist', String(params.has_waitlist))
  }
  if (params.page) searchParams.set('page', String(params.page))
  if (params.per_page) searchParams.set('per_page', String(params.per_page))

  const query = searchParams.toString()
  const path = query ? `/table-templates?${query}` : '/table-templates'

  const response = await apiFetch<TableTemplateListResponse>(path, { method: 'GET' })
  return {
    ...response,
    templates: (response.templates || []).map(normalizeTemplateInfo),
  }
}

export async function createTableTemplate(
  data: TableTemplatePayload,
  initData?: string | null,
): Promise<TableTemplateInfo> {
  const options: ApiFetchOptions = {
    method: 'POST',
    body: data as Record<string, unknown>,
  }
  if (initData) {
    options.initData = initData
  }
  const response = await apiFetch<TableTemplateInfo>('/table-templates', options)
  return normalizeTemplateInfo(response)
}

export async function updateTableTemplate(
  templateId: string,
  data: TableTemplateUpdatePayload,
  initData?: string | null,
): Promise<TableTemplateInfo> {
  const options: ApiFetchOptions = {
    method: 'PUT',
    body: data as Record<string, unknown>,
  }
  if (initData) {
    options.initData = initData
  }
  const response = await apiFetch<TableTemplateInfo>(`/table-templates/${templateId}`, options)
  return normalizeTemplateInfo(response)
}

export async function getTableTemplate(
  templateId: string,
  initData?: string | null,
): Promise<TableTemplateInfo> {
  const options: ApiFetchOptions = { method: 'GET' }
  if (initData) {
    options.initData = initData
  }
  const response = await apiFetch<TableTemplateInfo>(`/table-templates/${templateId}`, options)
  return normalizeTemplateInfo(response)
}

export async function deleteTableTemplate(
  templateId: string,
  initData?: string | null,
): Promise<void> {
  const options: ApiFetchOptions = { method: 'DELETE' }
  if (initData) {
    options.initData = initData
  }
  await apiFetch<void>(`/table-templates/${templateId}`, options)
}
