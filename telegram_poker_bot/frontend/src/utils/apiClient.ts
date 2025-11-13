const DEFAULT_HEADERS: HeadersInit = {
  Accept: 'application/json',
}

const API_BASE_CACHE: { api?: string; ws?: string } = {}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '')
}

function ensureLeadingSlash(path: string) {
  return path.startsWith('/') ? path : `/${path}`
}

export function getApiBaseUrl(): string {
  if (API_BASE_CACHE.api !== undefined) {
    return API_BASE_CACHE.api
  }

  const raw = typeof import.meta !== 'undefined' ? import.meta.env.VITE_API_URL : undefined
  const trimmed = typeof raw === 'string' ? raw.trim() : ''

  if (trimmed) {
    API_BASE_CACHE.api = normalizeBaseUrl(trimmed)
    return API_BASE_CACHE.api
  }

  // Default to /api for production behind Nginx
  API_BASE_CACHE.api = '/api'
  return API_BASE_CACHE.api
}

export function resolveApiUrl(endpoint: string, query?: Record<string, unknown>): string {
  if (/^https?:\/\//i.test(endpoint)) {
    const absolute = new URL(endpoint)
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return
        }
        absolute.searchParams.set(key, String(value))
      })
    }
    return absolute.toString()
  }

  const baseUrl = getApiBaseUrl()
  const target = baseUrl ? `${baseUrl}${ensureLeadingSlash(endpoint)}` : ensureLeadingSlash(endpoint)
  if (!query || Object.keys(query).length === 0) {
    return target
  }

  const baseForUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : undefined)
  if (!baseForUrl) {
    const searchParams = new URLSearchParams()
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return
      }
      searchParams.set(key, String(value))
    })
    const suffix = searchParams.toString()
    return suffix ? `${target}?${suffix}` : target
  }

  const url = new URL(target, baseForUrl)
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    url.searchParams.set(key, String(value))
  })
  return url.toString()
}

export function getWebSocketBaseUrl(): string {
  if (API_BASE_CACHE.ws !== undefined) {
    return API_BASE_CACHE.ws
  }

  const apiBase = getApiBaseUrl()
  if (!apiBase) {
    API_BASE_CACHE.ws = ''
    return API_BASE_CACHE.ws
  }

  if (apiBase.startsWith('https://')) {
    API_BASE_CACHE.ws = `wss://${apiBase.slice('https://'.length)}`
    return API_BASE_CACHE.ws
  }

  if (apiBase.startsWith('http://')) {
    API_BASE_CACHE.ws = `ws://${apiBase.slice('http://'.length)}`
    return API_BASE_CACHE.ws
  }

  API_BASE_CACHE.ws = apiBase
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
