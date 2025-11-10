const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(response: Response, data: unknown, message?: string) {
    super(
      message ||
        (typeof data === 'object' && data && 'detail' in data
          ? String((data as { detail: unknown }).detail)
          : `Request failed with status ${response.status}`),
    )
    this.name = 'ApiError'
    this.status = response.status
    this.data = data
  }
}

export interface ApiFetchOptions extends RequestInit {
  initData?: string
  json?: unknown
}

function resolveUrl(path: string) {
  if (/^https?:/i.test(path)) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

function isFormLike(value: unknown): value is
  | FormData
  | URLSearchParams
  | Blob
  | ArrayBufferView
  | ArrayBuffer
  | ReadableStream
  | string {
  return (
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value as ArrayBufferView) ||
    value instanceof ReadableStream ||
    typeof value === 'string'
  )
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { initData, headers: inputHeaders, body, json, ...rest } = options
  const headers = new Headers(inputHeaders)

  if (initData) {
    headers.set('X-Telegram-Init-Data', initData)
  }

  let requestBody = body

  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(json)
  } else if (body && typeof body === 'object' && !isFormLike(body)) {
    headers.set('Content-Type', 'application/json')
    requestBody = JSON.stringify(body)
  }

  const response = await fetch(resolveUrl(path), {
    ...rest,
    headers,
    body: requestBody,
  })

  const text = await response.text()
  let data: unknown = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    throw new ApiError(response, data)
  }

  return data as T
}
