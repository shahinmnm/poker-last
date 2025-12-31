import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCirclePlus,
  faLock,
  faMagnifyingGlass,
  faRotateRight,
  faSliders,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'

import LobbyHeader from './LobbyHeader'
import QuickSeatCard from './QuickSeatCard'
import LobbyTabs, { type LobbyTabKey } from './LobbyTabs'
import TableCard from './TableCard'
import FilterSheet from './FilterSheet'
import SortMenu from './SortMenu'
import EmptyState from './EmptyState'
import SkeletonRow from './SkeletonRow'
import {
  defaultLobbyFilters,
  fetchMockRecentTables,
  fetchMockTables,
  type LobbyFilters,
  type LobbySort,
  type TableSummary,
} from './mockLobbyData'
import { formatChips } from '../../utils/formatChips'
import Button from '../ui/Button'

const FAVORITES_KEY = 'poker.lobby.favorites'
const FILTER_KEY = 'poker.lobby.favoriteFilter'

const readStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem(key)
    if (!stored) return fallback
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

const writeStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage write failures.
  }
}

export default function LobbyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tables, setTables] = useState<TableSummary[]>([])
  const [recentTables, setRecentTables] = useState<TableSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [recentLoading, setRecentLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<LobbyTabKey>('cash')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<LobbyFilters>(defaultLobbyFilters)
  const [sort, setSort] = useState<LobbySort>('recently_active')
  const [filterOpen, setFilterOpen] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => readStorage(FAVORITES_KEY, []))
  const [savedFilter, setSavedFilter] = useState<LobbyFilters | null>(() => readStorage(FILTER_KEY, null))
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )

  const refreshTables = useCallback(() => {
    setLoading(true)
    fetchMockTables().then((data) => {
      setTables(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refreshTables()
    fetchMockRecentTables().then((data) => {
      setRecentTables(data)
      setRecentLoading(false)
    })
  }, [refreshTables])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    writeStorage(FAVORITES_KEY, favoriteIds)
  }, [favoriteIds])

  const filterBounds = useMemo(() => {
    if (!tables.length) {
      return {
        stakesMin: defaultLobbyFilters.stakesMin,
        stakesMax: defaultLobbyFilters.stakesMax,
        buyInMin: defaultLobbyFilters.buyInMin,
        buyInMax: defaultLobbyFilters.buyInMax,
      }
    }
    const stakesValues = tables.map((table) => table.stakesBig)
    const buyInMins = tables.map((table) => table.minBuyIn)
    const buyInMaxs = tables.map((table) => table.maxBuyIn)
    return {
      stakesMin: Math.min(...stakesValues),
      stakesMax: Math.max(...stakesValues),
      buyInMin: Math.min(...buyInMins),
      buyInMax: Math.max(...buyInMaxs),
    }
  }, [tables])

  useEffect(() => {
    if (!tables.length) return
    const nextFilters = {
      ...filters,
      stakesMin: Math.max(filters.stakesMin, filterBounds.stakesMin),
      stakesMax: Math.min(filters.stakesMax, filterBounds.stakesMax),
      buyInMin: Math.max(filters.buyInMin, filterBounds.buyInMin),
      buyInMax: Math.min(filters.buyInMax, filterBounds.buyInMax),
    }
    const changed =
      nextFilters.stakesMin !== filters.stakesMin ||
      nextFilters.stakesMax !== filters.stakesMax ||
      nextFilters.buyInMin !== filters.buyInMin ||
      nextFilters.buyInMax !== filters.buyInMax
    if (changed) {
      setFilters(nextFilters)
    }
  }, [filters, filterBounds, tables.length])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const formatStakes = useCallback((table: TableSummary) => {
    const symbol = table.currency === 'USD' ? '$' : ''
    return `${symbol}${formatChips(table.stakesSmall)}/${symbol}${formatChips(table.stakesBig)}`
  }, [])

  const recommendedTable = useMemo(() => {
    const joinable = tables.filter((table) => !table.isPrivate && table.players < table.maxPlayers)
    const sorted = [...joinable].sort((a, b) => {
      if (b.players !== a.players) return b.players - a.players
      return b.lastActiveAt - a.lastActiveAt
    })
    return sorted[0] || tables[0] || null
  }, [tables])

  const quickSeatRecommendation = useMemo(() => {
    if (!recommendedTable) return null
    return {
      stakesLabel: formatStakes(recommendedTable),
      seatsOpen: Math.max(recommendedTable.maxPlayers - recommendedTable.players, 0),
      tableName: recommendedTable.name,
    }
  }, [formatStakes, recommendedTable])

  const applyFilters = useCallback(
    (data: TableSummary[], applyTabFilter: boolean) => {
      const searchNeedle = search.trim().toLowerCase()
      const result = data.filter((table) => {
        if (applyTabFilter) {
          if (activeTab === 'cash' && (table.isPrivate || table.format !== 'cash')) return false
          if (activeTab === 'headsUp' && table.format !== 'headsUp') return false
          if (activeTab === 'private' && !table.isPrivate) return false
        }

        if (filters.seats.length > 0 && !filters.seats.includes(table.maxPlayers)) return false
        if (filters.joinableOnly && table.players >= table.maxPlayers) return false
        if (filters.favoritesOnly && !favoriteSet.has(table.id)) return false
        if (table.stakesBig < filters.stakesMin || table.stakesBig > filters.stakesMax) return false
        if (table.maxBuyIn < filters.buyInMin || table.minBuyIn > filters.buyInMax) return false

        if (searchNeedle) {
          const stakesLabel = `${table.stakesSmall}/${table.stakesBig}`
          const combined = `${table.name} ${stakesLabel}`.toLowerCase()
          if (!combined.includes(searchNeedle)) return false
        }
        return true
      })

      const sorted = [...result]
      switch (sort) {
        case 'stakes_high':
          sorted.sort((a, b) => b.stakesBig - a.stakesBig)
          break
        case 'seats_available':
          sorted.sort((a, b) => {
            const seatsA = a.maxPlayers - a.players
            const seatsB = b.maxPlayers - b.players
            return seatsB - seatsA
          })
          break
        case 'most_players':
          sorted.sort((a, b) => b.players - a.players)
          break
        case 'recently_active':
        default:
          sorted.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
          break
      }

      return sorted
    },
    [activeTab, favoriteSet, filters, search, sort],
  )

  const filteredTables = useMemo(() => applyFilters(tables, true), [applyFilters, tables])
  const filteredRecent = useMemo(
    () => applyFilters(recentTables, false),
    [applyFilters, recentTables],
  )

  const listTables = activeTab === 'history' ? filteredRecent : filteredTables
  const listLoading = activeTab === 'history' ? recentLoading : loading

  const sortOptions = useMemo(
    () => [
      { value: 'recently_active' as LobbySort, label: t('lobbyNew.sort.recentlyActive', 'Recently active') },
      { value: 'seats_available' as LobbySort, label: t('lobbyNew.sort.seatsAvailable', 'Seats available') },
      { value: 'most_players' as LobbySort, label: t('lobbyNew.sort.mostPlayers', 'Most players') },
      { value: 'stakes_high' as LobbySort, label: t('lobbyNew.sort.stakesHigh', 'Stakes high to low') },
    ],
    [t],
  )

  const tabLabels = useMemo(
    () => ({
      cash: t('lobbyNew.tabs.cash', 'Cash Tables'),
      headsUp: t('lobbyNew.tabs.headsUp', 'Heads-Up'),
      private: t('lobbyNew.tabs.private', 'Private'),
      history: t('lobbyNew.tabs.history', 'History'),
    }),
    [t],
  )

  const handleJoinTable = (table: TableSummary) => {
    console.info('[Lobby] Join table requested', table.id)
  }

  const handleQuickSeat = () => {
    if (!recommendedTable) return
    handleJoinTable(recommendedTable)
  }

  const toggleFavorite = (tableId: number) => {
    setFavoriteIds((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId],
    )
  }

  const resetFilters = () => {
    setFilters(defaultLobbyFilters)
    setSearch('')
  }

  const saveFavoriteFilter = () => {
    writeStorage(FILTER_KEY, filters)
    setSavedFilter(filters)
  }

  const loadFavoriteFilter = () => {
    if (!savedFilter) return
    setFilters(savedFilter)
  }

  return (
    <div className="space-y-4 pb-6">
      <LobbyHeader />

      {isOffline && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-2)]">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
          {t('lobbyNew.offline.title', 'Reconnecting...')}
        </div>
      )}

      <QuickSeatCard
        recommendation={quickSeatRecommendation}
        onQuickSeat={handleQuickSeat}
        disabled={!recommendedTable}
      />

      <div className="grid grid-cols-3 gap-2">
        <Button
          size="md"
          variant="secondary"
          className="min-h-[44px] gap-2"
          onClick={() => navigate('/games/create')}
        >
          <FontAwesomeIcon icon={faCirclePlus} />
          {t('lobbyNew.actions.createTable', 'Create Table')}
        </Button>
        <Button
          size="md"
          variant="secondary"
          className="min-h-[44px] gap-2"
          onClick={() => navigate('/games/join')}
        >
          <FontAwesomeIcon icon={faLock} />
          {t('lobbyNew.actions.joinPrivate', 'Join Private')}
        </Button>
        <Button
          size="md"
          variant="secondary"
          className="min-h-[44px] gap-2"
          onClick={refreshTables}
        >
          <FontAwesomeIcon icon={faRotateRight} />
          {t('lobbyNew.actions.refresh', 'Refresh')}
        </Button>
      </div>

      <LobbyTabs activeTab={activeTab} onChange={setActiveTab} labels={tabLabels} />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="absolute top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)]"
              style={{ insetInlineStart: '0.75rem' }}
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('lobbyNew.search.placeholder', 'Search tables')}
              className="w-full min-h-[44px] rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] pl-9 pr-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--border-1)]"
              dir="auto"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-2)] bg-[var(--surface-2)] px-4 text-xs font-semibold text-[var(--text-2)]"
          >
            <FontAwesomeIcon icon={faSliders} />
            {t('lobbyNew.actions.filters', 'Filters')}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <SortMenu value={sort} options={sortOptions} onChange={setSort} label={t('lobbyNew.actions.sort', 'Sort')} />
          <span className="text-xs text-[var(--text-3)] tabular-nums">
            {listLoading ? t('common.loading', 'Loading...') : `${listTables.length}`}
          </span>
        </div>
      </div>

      {activeTab === 'history' && (
        <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] px-4 py-3 text-sm text-[var(--text-2)]">
          <p className="font-semibold text-[var(--text-1)]">
            {t('lobbyNew.history.title', 'Recent tables')}
          </p>
          <p className="text-xs text-[var(--text-3)]">
            {t('lobbyNew.history.subtitle', 'Last 5 tables you joined')}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {listLoading &&
          Array.from({ length: 6 }, (_, index) => <SkeletonRow key={`skeleton-${index}`} />)}

        {!listLoading && listTables.length === 0 && (
          <EmptyState
            title={t('lobbyNew.empty.title', 'No tables match filters')}
            description={t('lobbyNew.empty.subtitle', 'Try adjusting filters or search.')}
            actionLabel={t('lobbyNew.actions.resetFilters', 'Reset filters')}
            onAction={resetFilters}
          />
        )}

        {!listLoading &&
          listTables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              isFavorite={favoriteSet.has(table.id)}
              onToggleFavorite={toggleFavorite}
              onJoin={handleJoinTable}
              actionLabel={
                activeTab === 'history'
                  ? t('lobbyNew.history.rejoin', 'Rejoin')
                  : undefined
              }
            />
          ))}
      </div>

      <FilterSheet
        isOpen={filterOpen}
        filters={filters}
        bounds={filterBounds}
        onChange={setFilters}
        onClose={() => setFilterOpen(false)}
        onReset={resetFilters}
        onSaveFavorite={saveFavoriteFilter}
        onLoadFavorite={savedFilter ? loadFavoriteFilter : undefined}
        hasSavedFilter={Boolean(savedFilter)}
      />
    </div>
  )
}
