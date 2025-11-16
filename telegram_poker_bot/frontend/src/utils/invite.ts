export const INVITE_CODE_LENGTH = 6
export const INVITE_CODE_MAX_LENGTH = 8
export const INVITE_CODE_PATTERN = /^[A-Z0-9]{6,8}$/

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, INVITE_CODE_MAX_LENGTH)
}

export function extractInviteCodeFromPayload(raw: string): string {
  const trimmed = raw.trim()

  // Quick path: direct code
  if (INVITE_CODE_PATTERN.test(normalizeInviteCode(trimmed))) {
    return normalizeInviteCode(trimmed)
  }

  // Try to parse URL with code query param
  try {
    const parsed = new URL(trimmed)
    const possibleKeys = ['code', 'invite_code', 'invite', 'game']
    for (const key of possibleKeys) {
      const value = parsed.searchParams.get(key)
      if (value) {
        const normalized = normalizeInviteCode(value)
        if (INVITE_CODE_PATTERN.test(normalized)) {
          return normalized
        }
      }
    }

    // Sometimes code may be last segment
    const segments = parsed.pathname.split('/')
    const last = segments[segments.length - 1]
    const normalizedPathCode = normalizeInviteCode(last)
    if (INVITE_CODE_PATTERN.test(normalizedPathCode)) {
      return normalizedPathCode
    }
  } catch {
    // ignore parse errors
  }

  return ''
}

export function buildInviteUrl(inviteCode: string): string {
  const normalized = normalizeInviteCode(inviteCode)
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  const url = new URL('/games/join', base || 'https://t.me')
  url.searchParams.set('code', normalized)
  return url.toString()
}
