const DEFAULT_HEADERS: HeadersInit = {
  Accept: 'application/json',
}

type ApiBaseKind = 'none' | 'relative' | 'absolute'

interface ApiBaseInfo {
  kind: ApiBaseKind
  value: string
}

const API_BASE_CACHE: { api?: ApiBaseInfo; ws?: string } = {}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function ensureApiSuffix(value: string) {
  const normalized = normalizeBaseUrl(value)
  if (!normalized) {
    return '/api'
  }
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`
}

function ensureLeadingSlash(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

function getApiBaseInfo(): ApiBaseInfo {
  if (API_BASE_CACHE.api) {
    return API_BASE_CACHE.api
  }

  const raw = typeof import.meta !== 'undefined' ? import.meta.env.VITE_API_URL : undefined
  const trimmed = typeof raw === 'string' ? raw.trim() : ''

  if (!trimmed) {
    const fallback: ApiBaseInfo = { kind: 'relative', value: '/api' }
    API_BASE_CACHE.api = fallback
    return fallback
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const info: ApiBaseInfo = { kind: 'absolute', value: ensureApiSuffix(trimmed) }
    API_BASE_CACHE.api = info
    return info
  }

  if (trimmed.startsWith('/')) {
    const info: ApiBaseInfo = { kind: 'relative', value: ensureApiSuffix(trimmed) }
    API_BASE_CACHE.api = info
    return info
  }

  const fallback: ApiBaseInfo = { kind: 'absolute', value: ensureApiSuffix(trimmed) }
  API_BASE_CACHE.api = fallback
  return fallback
}

export function getApiBaseUrl(): string {
  return getApiBaseInfo().value
}

export function buildApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint
  }

  const { kind, value } = getApiBaseInfo()
  const path = ensureLeadingSlash(endpoint)

  if (kind === 'none') {
    return path
  }

  if (kind === 'relative') {
    return `${value}${path}`
  }

  try {
    return new URL(path, value).toString()
  } catch {
    return `${value}${path}`
  }
}

export function resolveApiUrl(endpoint: string, query?: Record<string, unknown>): string {
  const target = buildApiUrl(endpoint)

  if (!query || Object.keys(query).length === 0) {
    return target
  }

  const isAbsolute = /^https?:\/\//i.test(target)

  if (isAbsolute) {
    try {
      const url = new URL(target)
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return
        }
        url.searchParams.set(key, String(value))
      })
      return url.toString()
    } catch {
      // fall through to string-based handling below
    }
  }

  const searchParams = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    searchParams.set(key, String(value))
  })
  const suffix = searchParams.toString()
  if (!suffix) {
    return target
  }
  return `${target}${target.includes('?') ? '&' : '?'}${suffix}`
}

export function getWebSocketBaseUrl(): string {
  if (API_BASE_CACHE.ws !== undefined) {
    return API_BASE_CACHE.ws
  }

  const { kind, value } = getApiBaseInfo()

  if (!value) {
    API_BASE_CACHE.ws = ''
    return API_BASE_CACHE.ws
  }

  if (kind === 'absolute') {
    // Strip /api suffix if present for absolute URLs
    // This allows WebSocket connections to work with nginx routing
    // where /api/* routes to API but /ws/* routes to WebSocket endpoint
    let baseUrl = value
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.slice(0, -4) // Remove '/api' suffix
    }

    if (baseUrl.startsWith('https://')) {
      API_BASE_CACHE.ws = `wss://${baseUrl.slice('https://'.length)}`
      return API_BASE_CACHE.ws
    }

    if (baseUrl.startsWith('http://')) {
      API_BASE_CACHE.ws = `ws://${baseUrl.slice('http://'.length)}`
      return API_BASE_CACHE.ws
    }

    API_BASE_CACHE.ws = baseUrl
    return API_BASE_CACHE.ws
  }

  // For relative paths, strip /api suffix if present
  let relativePath = value
  if (relativePath.endsWith('/api')) {
    relativePath = relativePath.slice(0, -4)
  }
  API_BASE_CACHE.ws = relativePath
  return API_BASE_CACHE.ws
}

export function resolveWebSocketUrl(path: string) {
  if (/^wss?:\/\//i.test(path)) {
    return path
  }
  const base = getWebSocketBaseUrl()
  if (!base) {
    return ensureLeadingSlash(path)
  }
  return `${base}${ensureLeadingSlash(path)}`
}

export interface ApiFetchOptions {
  method?: string
  headers?: HeadersInit
  /**
   * Optional Telegram init data string to send as header.
   * The value will be forwarded via `X-Telegram-Init-Data`.
   */
  initData?: string | null
  /**
   * Request body. Objects will be JSON-stringified automatically.
   */
  body?: BodyInit | Record<string, unknown> | null
  /**
   * Optional query string parameters. Keys with `undefined` values are skipped.
   */
  query?: Record<string, string | number | boolean | null | undefined>
  signal?: AbortSignal
}

export class ApiError<TData = unknown> extends Error {
  readonly status: number
  readonly data: TData | null
  readonly response: Response

  constructor(response: Response, data: TData | null) {
    const message =
      (data && typeof data === 'object' && 'message' in data
        ? String((data as { message?: unknown }).message)
        : null) || response.statusText || 'Request failed'
    super(message)
    this.name = 'ApiError'
    this.status = response.status
    this.data = data
    this.response = response
  }
}

function isObjectBody(body: ApiFetchOptions['body']): body is Record<string, unknown> {
  return !!body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)
}

export async function apiFetch<T>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    method = 'GET',
    headers,
    initData,
    body = null,
    query,
    signal,
  } = options

  const url = resolveApiUrl(endpoint, query)

  const resolvedHeaders = new Headers(DEFAULT_HEADERS)
  if (headers) {
    new Headers(headers).forEach((value, key) => resolvedHeaders.set(key, value))
  }

  let resolvedBody: BodyInit | null = null
  if (body instanceof FormData || body instanceof Blob || typeof body === 'string' || body instanceof URLSearchParams) {
    resolvedBody = body
    // Content-Type is set automatically for FormData/Blob; leave user-provided header intact.
  } else if (isObjectBody(body)) {
    resolvedBody = JSON.stringify(body)
    if (!resolvedHeaders.has('Content-Type')) {
      resolvedHeaders.set('Content-Type', 'application/json')
    }
  } else if (body != null) {
    resolvedBody = body as BodyInit
  }

  if (initData) {
    resolvedHeaders.set('X-Telegram-Init-Data', initData)
  }

  const response = await fetch(url, {
    method,
    headers: resolvedHeaders,
    body: resolvedBody,
    signal,
  })

  const contentType = response.headers.get('Content-Type')
  const isJson = contentType?.includes('application/json') ?? false
  let data: unknown = null

  if (response.status !== 204) {
    try {
      data = isJson ? await response.json() : await response.text()
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    throw new ApiError(response, data)
  }

  return data as T
}


// ============================================================================
// Admin Ops Dashboard API Types
// ============================================================================

export interface AdminTableSummary {
  table_id: number
  template_type: string | null
  is_public: boolean
  status: string | null
  current_hand_id: number | null
  current_hand_status: string | null
  seated_count: number
  active_count: number
  sitting_out_count: number
  expires_at: string | null
  last_action_at: string | null
  lobby_persistent: boolean
  is_auto_generated: boolean
  restore_error: string | null
  created_at: string | null
  is_stuck: boolean
}

export interface AdminTableListResponse {
  timestamp: string
  tables: AdminTableSummary[]
  count: number
  filters_applied: {
    status: string | null
    is_public: boolean | null
    stuck_only: boolean
  }
}

export interface AdminSeatDetail {
  seat_id: number
  position: number
  user_id: number
  username: string | null
  chips: number
  is_sitting_out_next_hand: boolean
  joined_at: string | null
  left_at: string | null
}

export interface AdminTableDetailResponse {
  timestamp: string
  table: {
    id: number
    status: string | null
    is_public: boolean
    lobby_persistent: boolean
    is_auto_generated: boolean
    expires_at: string | null
    created_at: string | null
    updated_at: string | null
    last_action_at: string | null
    creator_user_id: number | null
    sng_state: string | null
  }
  template: {
    id: string
    name: string
    table_type: string | null
    has_waitlist: boolean
    is_active: boolean
  } | null
  current_hand: {
    id: number
    hand_no: number
    status: string
    started_at: string | null
    ended_at: string | null
    pot_size: number
  } | null
  last_hand: {
    id: number
    hand_no: number
    status: string
    started_at: string | null
    ended_at: string | null
  } | null
  seats: AdminSeatDetail[]
  seat_summary: {
    total: number
    seated: number
    active: number
    sitting_out: number
  }
  runtime: Record<string, unknown>
  cache: Record<string, unknown>
  diagnostics: {
    is_stuck: boolean
    stuck_reason: string | null
  }
}

export interface AdminActionReport {
  timestamp: string
  table_id: number
  actions_taken: Array<{
    action: string
    [key: string]: unknown
  }>
  success: boolean
  request?: Record<string, unknown>
  mode?: string
  action?: string
}

export interface AdminSystemToggles {
  timestamp: string
  toggles: {
    pause_autostart: boolean
    pause_interhand_monitor: boolean
  }
  changes?: Array<{
    toggle: string
    old_value: boolean
    new_value: boolean
  }>
}


// ============================================================================
// Admin Ops Dashboard API Functions
// ============================================================================

export interface AdminListTablesOptions {
  status?: string
  is_public?: boolean
  stuck_only?: boolean
  limit?: number
}

/**
 * List all tables with admin diagnostics
 */
export async function adminListTables(options: AdminListTablesOptions = {}): Promise<AdminTableListResponse> {
  return apiFetch<AdminTableListResponse>('/admin/tables', {
    query: {
      status_filter: options.status,
      is_public: options.is_public,
      stuck_only: options.stuck_only,
      limit: options.limit,
    },
  })
}

/**
 * Get full diagnostics for a specific table
 */
export async function adminGetTable(tableId: number): Promise<AdminTableDetailResponse> {
  return apiFetch<AdminTableDetailResponse>(`/admin/tables/${tableId}`)
}

export interface ResetStuckHandOptions {
  kick_players?: boolean
  clear_runtime_cache?: boolean
  reason?: string
}

/**
 * Reset a stuck hand on a table
 */
export async function adminResetStuckHand(
  tableId: number,
  options: ResetStuckHandOptions = {}
): Promise<AdminActionReport> {
  return apiFetch<AdminActionReport>(`/admin/tables/${tableId}/reset-stuck-hand`, {
    method: 'POST',
    body: {
      kick_players: options.kick_players ?? false,
      clear_runtime_cache: options.clear_runtime_cache ?? true,
      reason: options.reason,
    },
  })
}

/**
 * Force a table to WAITING status
 */
export async function adminForceWaiting(tableId: number): Promise<AdminActionReport> {
  return apiFetch<AdminActionReport>(`/admin/tables/${tableId}/force-waiting`, {
    method: 'POST',
  })
}

export interface KickAllOptions {
  mode?: 'after_hand' | 'immediate_abort_then_kick'
}

/**
 * Kick all players from a table
 */
export async function adminKickAll(
  tableId: number,
  options: KickAllOptions = {}
): Promise<AdminActionReport> {
  return apiFetch<AdminActionReport>(`/admin/tables/${tableId}/kick-all`, {
    method: 'POST',
    body: {
      mode: options.mode ?? 'after_hand',
    },
  })
}

/**
 * Clear Redis runtime cache for a table
 */
export async function adminClearRuntimeCache(tableId: number): Promise<AdminActionReport> {
  return apiFetch<AdminActionReport>(`/admin/tables/${tableId}/clear-runtime-cache`, {
    method: 'POST',
  })
}

/**
 * Force broadcast the current table state to all connected clients
 */
export async function adminBroadcastSnapshot(tableId: number): Promise<AdminActionReport> {
  return apiFetch<AdminActionReport>(`/admin/tables/${tableId}/broadcast-snapshot`, {
    method: 'POST',
  })
}

/**
 * Get current system toggle values
 */
export async function adminGetSystemToggles(): Promise<AdminSystemToggles> {
  return apiFetch<AdminSystemToggles>('/admin/system/toggles')
}

export interface SetSystemTogglesOptions {
  pause_autostart?: boolean
  pause_interhand_monitor?: boolean
}

/**
 * Set system toggle values
 */
export async function adminSetSystemToggles(
  options: SetSystemTogglesOptions
): Promise<AdminSystemToggles> {
  return apiFetch<AdminSystemToggles>('/admin/system/toggles', {
    method: 'POST',
    body: options as Record<string, unknown>,
  })
}


// ============================================================================
// Admin Session Management
// ============================================================================

export interface AdminSessionValidateResponse {
  valid: boolean
  admin_chat_id?: number
  expires_at?: string
}

export interface AdminAuditLogEntry {
  id: string
  admin_chat_id: number
  action_type: string
  target?: string
  reason?: string
  metadata?: Record<string, unknown>
  ip_hash?: string
  timestamp: string
}

export interface AdminAuditLogsResponse {
  entries: AdminAuditLogEntry[]
  total: number
}

/**
 * Validate the current admin session
 */
export async function adminValidateSession(): Promise<AdminSessionValidateResponse> {
  return apiFetch<AdminSessionValidateResponse>('/admin/session/validate')
}

/**
 * Logout and invalidate admin session
 */
export async function adminLogout(): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>('/admin/logout', {
    method: 'POST',
  })
}

/**
 * Get admin audit logs
 */
export async function adminGetAuditLogs(options: {
  limit?: number
  offset?: number
  action_type?: string
} = {}): Promise<AdminAuditLogsResponse> {
  return apiFetch<AdminAuditLogsResponse>('/admin/audit-logs', {
    query: {
      limit: options.limit,
      offset: options.offset,
      action_type: options.action_type,
    },
  })
}


// ============================================================================
// Admin Dashboard KPIs
// ============================================================================

export interface AdminDashboardKPIs {
  timestamp: string
  kpis: {
    total_users: number
    active_tables: number
    tables_by_status: Record<string, number>
    hands_24h: number
    deposits_24h: number
    withdrawals_24h: number
    net_flow_24h: number
    active_players_24h: number
    stuck_tables: number
  }
}

/**
 * Get dashboard KPIs
 */
export async function adminGetDashboardKPIs(): Promise<AdminDashboardKPIs> {
  return apiFetch<AdminDashboardKPIs>('/admin/dashboard/kpis')
}


// ============================================================================
// Admin User/Banking APIs
// ============================================================================

export interface AdminUserSummary {
  id: number
  tg_user_id: number
  username: string | null
  balance_real: number
  balance_play: number
  first_seen_at: string | null
  last_seen_at: string | null
}

export interface AdminUsersResponse {
  users: AdminUserSummary[]
  count: number
  offset: number
  limit: number
}

export interface AdminUserWallet {
  user: {
    id: number
    tg_user_id: number
    username: string | null
  }
  wallet: {
    balance_real: number
    balance_play: number
  }
  recent_transactions: Array<{
    id: number
    type: string
    amount: number
    balance_after: number
    currency_type: string
    metadata: Record<string, unknown> | null
    created_at: string | null
  }>
}

export interface AdminTransactionSummary {
  id: number
  user_id: number
  type: string
  amount: number
  balance_after: number
  currency_type: string
  reference_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string | null
}

export interface AdminTransactionsResponse {
  transactions: AdminTransactionSummary[]
  count: number
  offset: number
  limit: number
}

export interface AdminBalanceChangeResponse {
  success: boolean
  user_id: number
  amount: number
  currency_type: string
  new_balance: number
  reason: string
}

/**
 * List users with optional search
 */
export async function adminListUsers(options: {
  search?: string
  limit?: number
  offset?: number
} = {}): Promise<AdminUsersResponse> {
  return apiFetch<AdminUsersResponse>('/admin/users', {
    query: {
      search: options.search,
      limit: options.limit,
      offset: options.offset,
    },
  })
}

/**
 * Get user wallet details
 */
export async function adminGetUserWallet(userId: number): Promise<AdminUserWallet> {
  return apiFetch<AdminUserWallet>(`/admin/users/${userId}/wallet`)
}

/**
 * Deposit funds to a user's wallet
 */
export async function adminDeposit(
  userId: number,
  options: {
    amount: number
    reason: string
    currency_type?: string
    client_action_id?: string
  }
): Promise<AdminBalanceChangeResponse> {
  return apiFetch<AdminBalanceChangeResponse>(`/admin/users/${userId}/deposit`, {
    method: 'POST',
    body: {
      amount: options.amount,
      reason: options.reason,
      currency_type: options.currency_type ?? 'REAL',
      client_action_id: options.client_action_id,
    },
  })
}

/**
 * Withdraw funds from a user's wallet
 */
export async function adminWithdraw(
  userId: number,
  options: {
    amount: number
    reason: string
    currency_type?: string
    client_action_id?: string
  }
): Promise<AdminBalanceChangeResponse> {
  return apiFetch<AdminBalanceChangeResponse>(`/admin/users/${userId}/withdraw`, {
    method: 'POST',
    body: {
      amount: options.amount,
      reason: options.reason,
      currency_type: options.currency_type ?? 'REAL',
      client_action_id: options.client_action_id,
    },
  })
}

/**
 * List transactions with filters
 */
export async function adminListTransactions(options: {
  user_id?: number
  tx_type?: string
  currency_type?: string
  limit?: number
  offset?: number
} = {}): Promise<AdminTransactionsResponse> {
  return apiFetch<AdminTransactionsResponse>('/admin/transactions', {
    query: {
      user_id: options.user_id,
      tx_type: options.tx_type,
      currency_type: options.currency_type,
      limit: options.limit,
      offset: options.offset,
    },
  })
}
