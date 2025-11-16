export const INVITE_CODE_LENGTH = 6
export const INVITE_CODE_MAX_LENGTH = 8
export const INVITE_CODE_PATTERN = /^[A-Z0-9]{6,8}$/

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, INVITE_CODE_MAX_LENGTH)
}
