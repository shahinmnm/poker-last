export interface RecentInviteEntry {
  gameId: string
  groupTitle?: string | null
  status?: string | null
  lastUpdated: string
}

const STORAGE_KEY = 'pokerbot.recentInvites'
const MAX_ENTRIES = 10

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function normalizeEntry(value: Partial<RecentInviteEntry>): RecentInviteEntry | null {
  if (!value.gameId) {
    return null
  }

  const timestamp = value.lastUpdated && !Number.isNaN(Date.parse(value.lastUpdated))
    ? value.lastUpdated
    : new Date().toISOString()

  return {
    gameId: String(value.gameId),
    groupTitle: value.groupTitle ?? null,
    status: value.status ?? null,
    lastUpdated: timestamp,
  }
}

export function loadRecentInvites(): RecentInviteEntry[] {
  const storage = getStorage()
  if (!storage) {
    return []
  }

  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map((item) => normalizeEntry(item))
      .filter((item): item is RecentInviteEntry => item !== null)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
  } catch {
    return []
  }
}

export function saveRecentInvites(entries: RecentInviteEntry[]): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // Ignore persistence failures.
  }
}

export function upsertRecentInvite(
  entry: Omit<RecentInviteEntry, 'lastUpdated'> & { lastUpdated?: string },
): RecentInviteEntry[] {
  const normalized = normalizeEntry({
    ...entry,
    lastUpdated: entry.lastUpdated ?? new Date().toISOString(),
  })

  if (!normalized) {
    return loadRecentInvites()
  }

  const current = loadRecentInvites()
  const next = [normalized, ...current.filter((item) => item.gameId !== normalized.gameId)].slice(
    0,
    MAX_ENTRIES,
  )
  saveRecentInvites(next)
  return next
}

export function clearRecentInvites(): void {
  const storage = getStorage()
  if (!storage) {
    return
  }
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage errors
  }
}
