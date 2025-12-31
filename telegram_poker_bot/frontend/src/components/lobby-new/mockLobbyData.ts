import type { LobbyEntry } from '@/types/normalized'

export type TableSpeed = 'standard' | 'turbo' | 'deep'

export type TableFormat = 'cash' | 'headsUp'

export interface TableSummary {
  id: number
  name: string
  stakesSmall: number
  stakesBig: number
  currency: string
  players: number
  maxPlayers: number
  minBuyIn: number
  maxBuyIn: number
  speed: TableSpeed
  format: TableFormat
  isPrivate: boolean
  lastActiveAt: number
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
    id: 1101,
    name: 'Royal Velvet',
    stakesSmall: 1,
    stakesBig: 2,
    currency: 'USD',
    players: 4,
    maxPlayers: 6,
    minBuyIn: 80,
    maxBuyIn: 400,
    speed: 'deep',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 120000,
  },
  {
    id: 1102,
    name: 'Emerald Pulse',
    stakesSmall: 2,
    stakesBig: 4,
    currency: 'USD',
    players: 6,
    maxPlayers: 6,
    minBuyIn: 120,
    maxBuyIn: 800,
    speed: 'turbo',
    format: 'cash',
    isPrivate: false,
    lastActiveAt: now - 420000,
  },
  {
    id: 1103,
    name: 'Gold Leaf Heads-Up',
    stakesSmall: 5,
    stakesBig: 10,
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
    id: 1104,
    name: 'Midnight Private',
    stakesSmall: 1,
    stakesBig: 2,
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
    id: 1105,
    name: 'Sapphire Sprint',
    stakesSmall: 0.5,
    stakesBig: 1,
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
    id: 1106,
    name: 'Deep Stack Society',
    stakesSmall: 2,
    stakesBig: 5,
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
    id: 1107,
    name: 'Neon Two',
    stakesSmall: 3,
    stakesBig: 6,
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
    id: 1108,
    name: 'Private Reserve',
    stakesSmall: 5,
    stakesBig: 10,
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
    id: 1109,
    name: 'Velvet Six',
    stakesSmall: 1,
    stakesBig: 3,
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
    id: 1110,
    name: 'High Limit Halo',
    stakesSmall: 10,
    stakesBig: 25,
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
    id: 1111,
    name: 'Arcade Heads-Up',
    stakesSmall: 2,
    stakesBig: 4,
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
    id: 1112,
    name: 'Velvet Code',
    stakesSmall: 0.25,
    stakesBig: 0.5,
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
]

export const mockRecentTables: TableSummary[] = [
  mockTables[0],
  mockTables[2],
  mockTables[5],
  mockTables[7],
  mockTables[9],
]

export const defaultLobbyFilters: LobbyFilters = {
  stakesMin: 0.25,
  stakesMax: 25,
  seats: [],
  buyInMin: 20,
  buyInMax: 6000,
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

export function adaptLobbyEntry(entry: LobbyEntry): TableSummary {
  const stakesText = entry.stakes || '0/0'
  const normalized = stakesText.replace(/[^0-9./]/g, '')
  const [smallRaw, bigRaw] = normalized.split('/')
  const stakesSmall = Number(smallRaw || 0)
  const stakesBig = Number(bigRaw || smallRaw || 0)

  return {
    id: entry.table_id,
    name: entry.template_name,
    stakesSmall,
    stakesBig,
    currency: entry.currency || 'CHIPS',
    players: entry.player_count,
    maxPlayers: entry.max_players,
    minBuyIn: entry.buy_in_min ?? 0,
    maxBuyIn: entry.buy_in_max ?? 0,
    speed: 'standard',
    format: entry.max_players === 2 ? 'headsUp' : 'cash',
    isPrivate: entry.table_type === 'private' || Boolean(entry.invite_only),
    lastActiveAt: now - (entry.uptime ?? 0) * 1000,
  }
}
