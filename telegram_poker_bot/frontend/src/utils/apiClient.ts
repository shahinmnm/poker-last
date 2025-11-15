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
    const info: ApiBaseInfo = { kind: 'none', value: '' }
    API_BASE_CACHE.api = info
    return info
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const info: ApiBaseInfo = { kind: 'absolute', value: normalizeBaseUrl(trimmed) }
    API_BASE_CACHE.api = info
    return info
  }

  if (trimmed.startsWith('/')) {
    const info: ApiBaseInfo = { kind: 'relative', value: normalizeBaseUrl(trimmed) }
    API_BASE_CACHE.api = info
    return info
  }

  const fallback: ApiBaseInfo = { kind: 'absolute', value: normalizeBaseUrl(trimmed) }
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
    if (value.startsWith('https://')) {
      API_BASE_CACHE.ws = `wss://${value.slice('https://'.length)}`
      return API_BASE_CACHE.ws
    }

    if (value.startsWith('http://')) {
      API_BASE_CACHE.ws = `ws://${value.slice('http://'.length)}`
      return API_BASE_CACHE.ws
    }

    API_BASE_CACHE.ws = value
    return API_BASE_CACHE.ws
  }

  API_BASE_CACHE.ws = value
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
