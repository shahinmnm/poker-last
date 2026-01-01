import type { LobbyEntry } from '@/types/normalized'

export type TableSpeed = 'standard' | 'turbo' | 'deep'

export type TableFormat = 'cash' | 'headsUp'

export interface TableSummary {
  id: number
  name: string
  stakesSmall?: number | null
  stakesBig?: number | null
  avgPot?: number | null
  currency?: string | null
  players: number
  maxPlayers: number
  minBuyIn?: number | null
  maxBuyIn?: number | null
  speed?: TableSpeed | null
  format?: TableFormat | null
  isPrivate: boolean
  lastActiveAt?: number | null
  status?: string | null
}

export interface LobbyFilters {
  stakesMin: number
  stakesMax: number
  seats: number[]
  buyInMin: number
  buyInMax: number
  joinableOnly: boolean
  favoritesOnly: boolean
}

export type LobbySort =
  | 'stakes_high'
  | 'seats_available'
  | 'most_players'
  | 'recently_active'

const now = Date.now()

export const mockTables: TableSummary[] = [
  {
    id: 1201,
    name: 'Royal Velvet',
    stakesSmall: 0.5,
    stakesBig: 1,
    avgPot: 18,
    currency: 'USD',
    players: 5,
    maxPlayers: 6,
    minBuyIn: 60,
    maxBuyIn: 240,
    speed: 'deep',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 45000,
  },
  {
    id: 1202,
    name: 'Emerald Pulse',
    stakesSmall: 1,
    stakesBig: 2,
    avgPot: 34,
    currency: 'USD',
    players: 6,
    maxPlayers: 6,
    minBuyIn: 80,
    maxBuyIn: 400,
    speed: 'turbo',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 210000,
  },
  {
    id: 1203,
    name: 'Gold Leaf Heads-Up',
    stakesSmall: 5,
    stakesBig: 10,
    avgPot: 140,
    currency: 'USD',
    players: 1,
    maxPlayers: 2,
    minBuyIn: 250,
    maxBuyIn: 1500,
    speed: 'standard',
    format: 'headsUp',
    isPrivate: false,
    lastActiveAt: now - 90000,
  },
  {
    id: 1204,
    name: 'Midnight Private',
    stakesSmall: 1,
    stakesBig: 2,
    avgPot: 42,
    currency: 'USD',
    players: 3,
    maxPlayers: 6,
    minBuyIn: 100,
    maxBuyIn: 500,
    speed: 'standard',
    format: 'cash',
    isPrivate: true,
    lastActiveAt: now - 300000,
  },
  {
    id: 1205,
    name: 'Sapphire Sprint',
    stakesSmall: 0.5,
    stakesBig: 1,
    avgPot: 16,
    currency: 'USD',
    players: 2,
    maxPlayers: 6,
    minBuyIn: 40,
    maxBuyIn: 200,
    speed: 'turbo',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 60000,
  },
  {
    id: 1206,
    name: 'Deep Stack Society',
    stakesSmall: 2,
    stakesBig: 5,
    avgPot: 110,
    currency: 'USD',
    players: 5,
    maxPlayers: 6,
    minBuyIn: 200,
    maxBuyIn: 1200,
    speed: 'deep',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 240000,
  },
  {
    id: 1207,
    name: 'Neon Two',
    stakesSmall: 3,
    stakesBig: 6,
    avgPot: 92,
    currency: 'USD',
    players: 2,
    maxPlayers: 2,
    minBuyIn: 180,
    maxBuyIn: 900,
    speed: 'turbo',
    format: 'headsUp',
    isPrivate: false,
    lastActiveAt: now - 180000,
  },
  {
    id: 1208,
    name: 'Private Reserve',
    stakesSmall: 5,
    stakesBig: 10,
    avgPot: 190,
    currency: 'USD',
    players: 6,
    maxPlayers: 6,
    minBuyIn: 400,
    maxBuyIn: 2000,
    speed: 'deep',
    format: 'cash',
    isPrivate: true,
    lastActiveAt: now - 720000,
  },
  {
    id: 1209,
    name: 'Velvet Six',
    stakesSmall: 1,
    stakesBig: 3,
    avgPot: 58,
    currency: 'USD',
    players: 1,
    maxPlayers: 6,
    minBuyIn: 75,
    maxBuyIn: 450,
    speed: 'standard',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 30000,
  },
  {
    id: 1210,
    name: 'High Limit Halo',
    stakesSmall: 10,
    stakesBig: 25,
    avgPot: 420,
    currency: 'USD',
    players: 4,
    maxPlayers: 6,
    minBuyIn: 1000,
    maxBuyIn: 6000,
    speed: 'standard',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 900000,
  },
  {
    id: 1211,
    name: 'Arcade Heads-Up',
    stakesSmall: 2,
    stakesBig: 4,
    avgPot: 64,
    currency: 'USD',
    players: 2,
    maxPlayers: 2,
    minBuyIn: 120,
    maxBuyIn: 700,
    speed: 'standard',
    format: 'headsUp',
    isPrivate: false,
    lastActiveAt: now - 150000,
  },
  {
    id: 1212,
    name: 'Velvet Code',
    stakesSmall: 0.25,
    stakesBig: 0.5,
    avgPot: 9,
    currency: 'USD',
    players: 3,
    maxPlayers: 6,
    minBuyIn: 20,
    maxBuyIn: 120,
    speed: 'deep',
    format: 'cash',
    isPrivate: true,
    lastActiveAt: now - 540000,
  },
  {
    id: 1213,
    name: 'Iron Spade',
    stakesSmall: 0.1,
    stakesBig: 0.25,
    avgPot: 6,
    currency: 'USD',
    players: 4,
    maxPlayers: 6,
    minBuyIn: 15,
    maxBuyIn: 90,
    speed: 'standard',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 360000,
  },
  {
    id: 1214,
    name: 'Orbit Lounge',
    stakesSmall: 2,
    stakesBig: 4,
    avgPot: 78,
    currency: 'USD',
    players: 5,
    maxPlayers: 6,
    minBuyIn: 160,
    maxBuyIn: 900,
    speed: 'standard',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 110000,
  },
  {
    id: 1215,
    name: 'Crimson Stack',
    stakesSmall: 25,
    stakesBig: 50,
    avgPot: 860,
    currency: 'USD',
    players: 6,
    maxPlayers: 6,
    minBuyIn: 5000,
    maxBuyIn: 15000,
    speed: 'deep',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 840000,
  },
  {
    id: 1216,
    name: 'Harbor Private',
    stakesSmall: 1,
    stakesBig: 2,
    avgPot: 36,
    currency: 'USD',
    players: 2,
    maxPlayers: 6,
    minBuyIn: 90,
    maxBuyIn: 450,
    speed: 'standard',
    format: 'cash',
    isPrivate: true,
    lastActiveAt: now - 260000,
  },
]

export const mockRecentTables: TableSummary[] = [
  mockTables[0],
  mockTables[2],
  mockTables[5],
  mockTables[7],
  mockTables[10],
  mockTables[13],
]

export const defaultLobbyFilters: LobbyFilters = {
  stakesMin: 0.1,
  stakesMax: 50,
  seats: [],
  buyInMin: 15,
  buyInMax: 15000,
  joinableOnly: false,
  favoritesOnly: false,
}

export const fetchMockTables = (delayMs = 750): Promise<TableSummary[]> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(mockTables), delayMs)
  })

export const fetchMockRecentTables = (delayMs = 450): Promise<TableSummary[]> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(mockRecentTables), delayMs)
  })

function parseStakes(stakesText?: string | null) {
  if (!stakesText) {
    return { small: null, big: null }
  }
  const normalized = stakesText.replace(/[^0-9./]/g, '')
  if (!normalized) {
    return { small: null, big: null }
  }
  const [smallRaw, bigRaw] = normalized.split('/')
  const small = smallRaw ? Number(smallRaw) : NaN
  const big = bigRaw ? Number(bigRaw) : Number(smallRaw)
  return {
    small: Number.isFinite(small) ? small : null,
    big: Number.isFinite(big) ? big : Number.isFinite(small) ? small : null,
  }
}

export function adaptLobbyEntry(entry: LobbyEntry): TableSummary {
  const { small, big } = parseStakes(entry.stakes)

  return {
    id: entry.table_id,
    name: entry.template_name,
    stakesSmall: small,
    stakesBig: big,
    avgPot: null,
    currency: entry.currency ?? null,
    players: entry.player_count,
    maxPlayers: entry.max_players,
    minBuyIn: entry.buy_in_min ?? null,
    maxBuyIn: entry.buy_in_max ?? null,
    speed: null,
    format: entry.max_players === 2 ? 'headsUp' : 'cash',
    isPrivate: entry.table_type === 'private' || Boolean(entry.invite_only),
    lastActiveAt: null,
    status: null,
  }
}
