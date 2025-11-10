const DEFAULT_HEADERS: HeadersInit = {
  Accept: 'application/json',
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

function buildUrl(endpoint: string, query?: ApiFetchOptions['query']) {
  const baseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
  const isAbsolute = /^https?:\/\//i.test(endpoint)
  const normalizedEndpoint = isAbsolute
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`

  if (!query || Object.keys(query).length === 0) {
    return normalizedEndpoint
  }

  const url = new URL(normalizedEndpoint)
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    url.searchParams.set(key, String(value))
  })
  return url.toString()
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

  const url = buildUrl(endpoint, query)

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
