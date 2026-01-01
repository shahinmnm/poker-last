import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass,
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
  type LobbyFilters,
  type LobbySort,
  type TableSummary,
  adaptLobbyEntry,
} from './mockLobbyData'
import { formatChips } from '../../utils/formatChips'
import { useTelegram } from '../../hooks/useTelegram'
import { useLobbySync } from '../../hooks/useLobbySync'
import { apiFetch } from '../../utils/apiClient'
import { extractRuleSummary } from '../../utils/tableRules'
import type { TableSummary as BackendTableSummary } from '../../types'

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

const normalizeTablesResponse = <T,>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const candidate =
      (data as { tables?: T[] }).tables ||
      (data as { items?: T[] }).items ||
      (data as { data?: T[] }).data
    if (Array.isArray(candidate)) return candidate as T[]
  }
  return []
}

const parseTimestamp = (value?: string | null): number | null => {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizePositive = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

export default function LobbyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { initData, ready } = useTelegram()
  const publicQuery = useMemo(() => ({ scope: 'public' }), [])
  const {
    tables: lobbyEntries,
    refresh: refreshLobby,
    loading: loadingPublic,
    refreshing: refreshingPublic,
    error: errorPublic,
  } = useLobbySync({
    enabled: ready,
    refreshInterval: 25000,
    initData,
    query: publicQuery,
  })
  const [myTables, setMyTables] = useState<TableSummary[]>([])
  const [loadingMyTables, setLoadingMyTables] = useState(false)
  const [errorMyTables, setErrorMyTables] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
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
  const authMissing = ready && !initData

  const publicTables = useMemo(
    () => lobbyEntries.map((entry) => adaptLobbyEntry(entry)),
    [lobbyEntries],
  )

  const adaptMyTable = useCallback((table: BackendTableSummary): TableSummary => {
    const summary = extractRuleSummary(table.template, {
      max_players: table.max_players,
      currency_type: table.currency_type,
      table_name: table.table_name ?? null,
    })
    const maxPlayers = summary.maxPlayers ?? table.max_players ?? 0
    const format = maxPlayers === 2 ? 'headsUp' : 'cash'
    const name =
      summary.tableName ||
      table.table_name ||
      `Table #${table.table_id}`

    return {
      id: table.table_id,
      name,
      stakesSmall: normalizePositive(summary.stakes?.small ?? null),
      stakesBig: normalizePositive(summary.stakes?.big ?? null),
      avgPot: null,
      currency: summary.currencyType || table.currency_type || null,
      players: table.player_count ?? 0,
      maxPlayers,
      minBuyIn: null,
      maxBuyIn: null,
      speed: null,
      format,
      isPrivate:
        table.visibility === 'private' ||
        table.is_private === true ||
        table.is_public === false,
      lastActiveAt: parseTimestamp(table.updated_at) ?? parseTimestamp(table.created_at),
      status: table.status ?? null,
    }
  }, [])

  const fetchMyTables = useCallback(async () => {
    if (!ready) return
    abortControllerRef.current?.abort()

    if (!initData) {
      setMyTables([])
      setLoadingMyTables(false)
      setErrorMyTables(null)
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setLoadingMyTables(true)
    setErrorMyTables(null)

    try {
      const data = await apiFetch<unknown>('/users/me/tables', {
        initData,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      const normalized = normalizeTablesResponse<BackendTableSummary>(data)
      setMyTables(normalized.map(adaptMyTable))
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMyTables(error instanceof Error ? error.message : 'Failed to fetch tables')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMyTables(false)
      }
    }
  }, [adaptMyTable, initData, ready])

  useEffect(() => {
    void fetchMyTables()
    return () => abortControllerRef.current?.abort()
  }, [fetchMyTables])

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
    const stakesValues = publicTables
      .map((table) => table.stakesBig)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    const buyInMins = publicTables
      .map((table) => table.minBuyIn)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    const buyInMaxs = publicTables
      .map((table) => table.maxBuyIn)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)

    return {
      stakesMin: stakesValues.length
        ? Math.min(...stakesValues)
        : defaultLobbyFilters.stakesMin,
      stakesMax: stakesValues.length
        ? Math.max(...stakesValues)
        : defaultLobbyFilters.stakesMax,
      buyInMin: buyInMins.length
        ? Math.min(...buyInMins)
        : defaultLobbyFilters.buyInMin,
      buyInMax: buyInMaxs.length
        ? Math.max(...buyInMaxs)
        : defaultLobbyFilters.buyInMax,
    }
  }, [publicTables])

  useEffect(() => {
    if (!publicTables.length) return
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
  }, [filters, filterBounds, publicTables.length])

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds])

  const formatStakes = useCallback((table: TableSummary) => {
    const small = table.stakesSmall
    const big = table.stakesBig
    if (
      typeof small !== 'number' ||
      typeof big !== 'number' ||
      !Number.isFinite(small) ||
      !Number.isFinite(big) ||
      small <= 0 ||
      big <= 0
    ) {
      return '--'
    }
    const symbol = table.currency === 'USD' ? '$' : ''
    return `${symbol}${formatChips(small)}/${symbol}${formatChips(big)}`
  }, [])

  const recommendedTable = useMemo(() => {
    const statusPriority = (status?: string | null) => {
      if (!status) return 0
      const normalized = status.toLowerCase()
      if (['waiting', 'active', 'running'].includes(normalized)) return 2
      if (['starting', 'paused'].includes(normalized)) return 1
      return 0
    }

    const joinable = publicTables.filter(
      (table) => !table.isPrivate && table.players < table.maxPlayers,
    )
    const sorted = [...joinable].sort((a, b) => {
      const statusDiff = statusPriority(b.status) - statusPriority(a.status)
      if (statusDiff !== 0) return statusDiff
      if (b.players !== a.players) return b.players - a.players
      return (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0)
    })
    return sorted[0] || null
  }, [publicTables])

  const quickSeatRecommendation = useMemo(() => {
    if (!recommendedTable) return null
    return {
      stakesLabel: formatStakes(recommendedTable),
      seatsOpen: Math.max(recommendedTable.maxPlayers - recommendedTable.players, 0),
      tableName: recommendedTable.name,
    }
  }, [formatStakes, recommendedTable])

  const quickSeatFallbackLabel = useMemo(() => {
    if (!ready || loadingPublic || refreshingPublic) {
      return t('common.loading', 'Loading...')
    }
    return t('lobbyNew.quickSeat.empty', 'No open seats right now')
  }, [loadingPublic, ready, refreshingPublic, t])

  const applyFilters = useCallback(
    (data: TableSummary[], applyTabFilter: boolean) => {
      const searchNeedle = search.trim().toLowerCase()
      const result = data.filter((table) => {
        if (applyTabFilter) {
          if (activeTab === 'cash' && (table.isPrivate || table.format === 'headsUp')) return false
          if (activeTab === 'headsUp' && table.format !== 'headsUp' && table.maxPlayers !== 2) return false
          if (activeTab === 'private' && !table.isPrivate) return false
        }

        if (filters.seats.length > 0 && !filters.seats.includes(table.maxPlayers)) return false
        if (filters.joinableOnly && table.players >= table.maxPlayers) return false
        if (filters.favoritesOnly && !favoriteSet.has(table.id)) return false
        if (
          typeof table.stakesBig === 'number' &&
          table.stakesBig > 0 &&
          (table.stakesBig < filters.stakesMin || table.stakesBig > filters.stakesMax)
        ) {
          return false
        }
        if (typeof table.minBuyIn === 'number' && table.minBuyIn > 0 && table.minBuyIn > filters.buyInMax) {
          return false
        }
        if (typeof table.maxBuyIn === 'number' && table.maxBuyIn > 0 && table.maxBuyIn < filters.buyInMin) {
          return false
        }

        if (searchNeedle) {
          const stakesLabel =
            typeof table.stakesSmall === 'number' && typeof table.stakesBig === 'number'
              ? `${table.stakesSmall}/${table.stakesBig}`
              : ''
          const combined = `${table.name} ${stakesLabel}`.toLowerCase()
          if (!combined.includes(searchNeedle)) return false
        }
        return true
      })

      const sorted = [...result]
      switch (sort) {
        case 'stakes_high':
          sorted.sort((a, b) => {
            const aValue = typeof a.stakesBig === 'number' ? a.stakesBig : -Infinity
            const bValue = typeof b.stakesBig === 'number' ? b.stakesBig : -Infinity
            return bValue - aValue
          })
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
          sorted.sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0))
          break
      }

      return sorted
    },
    [activeTab, favoriteSet, filters, search, sort],
  )

  const filteredTables = useMemo(
    () => applyFilters(publicTables, true),
    [applyFilters, publicTables],
  )
  const filteredMyTables = useMemo(
    () => applyFilters(myTables, false),
    [applyFilters, myTables],
  )

  useEffect(() => {
    if (!import.meta.env?.DEV) {
      return
    }
    console.debug('[Lobby] table counts', {
      publicTables: publicTables.length,
      filteredTables: filteredTables.length,
    })
  }, [filteredTables.length, publicTables.length])

  const listTables = activeTab === 'history' ? filteredMyTables : filteredTables
  const listLoading =
    !ready ||
    (activeTab === 'history'
      ? loadingMyTables
      : loadingPublic || refreshingPublic)
  const totalCount = activeTab === 'history' ? myTables.length : publicTables.length
  const visibleCount = listTables.length
  const showSmallScopeHint =
    !listLoading && activeTab !== 'history' && totalCount > 0 && totalCount <= 2

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
      cash: t('lobbyNew.tabs.cash', 'Cash'),
      headsUp: t('lobbyNew.tabs.headsUp', 'Heads-Up'),
      private: t('lobbyNew.tabs.private', 'Private'),
      history: t('lobbyNew.tabs.history', 'History'),
    }),
    [t],
  )

  const refreshTables = useCallback(async () => {
    await Promise.all([refreshLobby(), fetchMyTables()])
  }, [fetchMyTables, refreshLobby])

  const handleJoinTable = useCallback(
    (table: TableSummary) => {
      if (!ready) {
        return
      }
      if (table.players >= table.maxPlayers) {
        return
      }
      if (table.isPrivate) {
        navigate('/games/join')
        return
      }
      navigate(`/table/${table.id}`)
    },
    [navigate, ready],
  )

  const handleCreateTable = useCallback(() => {
    navigate('/games/create')
  }, [navigate])

  const handleJoinPrivate = useCallback(() => {
    navigate('/games/join')
  }, [navigate])

  const handleQuickSeat = useCallback(() => {
    if (!recommendedTable) return
    handleJoinTable(recommendedTable)
  }, [handleJoinTable, recommendedTable])

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

  const actionsDisabled = !ready
  const activeError =
    !ready || authMissing ? null : activeTab === 'history' ? errorMyTables : errorPublic

  const emptyState = useMemo(() => {
    if (activeTab === 'history') {
      if (authMissing) {
        return {
          title: t('lobbyNew.empty.telegram', 'Open inside Telegram'),
          description: t(
            'lobbyNew.empty.telegramSubtitle',
            'Sign in with Telegram to see your tables and history.',
          ),
        }
      }
      return {
        title: t('lobbyNew.empty.history', 'No recent tables yet'),
        description: t(
          'lobbyNew.empty.historySubtitle',
          'Tables you join will show up here.',
        ),
      }
    }

    if (activeTab === 'private') {
      return {
        title: t('lobbyNew.empty.private', 'No private tables'),
        description: t(
          'lobbyNew.empty.privateSubtitle',
          'Private tables require an invite code.',
        ),
        actionLabel: t('lobbyNew.actions.joinPrivateShort', 'Join Private'),
        onAction: handleJoinPrivate,
      }
    }

    if (activeTab === 'headsUp') {
      return {
        title: t('lobbyNew.empty.headsUp', 'No heads-up tables'),
        description: t(
          'lobbyNew.empty.headsUpSubtitle',
          'Create a heads-up table or check back soon.',
        ),
        actionLabel: t('lobbyNew.actions.createTable', 'Create Table'),
        onAction: handleCreateTable,
      }
    }

    return {
      title: t('lobbyNew.empty.available', 'No tables available'),
      description: t(
        'lobbyNew.empty.availableSubtitle',
        'Create a table or refresh to find games.',
      ),
      actionLabel: t('lobbyNew.actions.createTable', 'Create Table'),
      onAction: handleCreateTable,
    }
  }, [activeTab, authMissing, handleCreateTable, handleJoinPrivate, t])

  return (
    <div
      className="lobby-screen space-y-3 pb-4"
    >
      <div className="lobby-safe-header">
        <LobbyHeader />
      </div>

      {isOffline && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-2)] bg-[var(--surface-3)] px-3 py-2 text-[11px] text-[var(--text-2)]">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin text-[10px]" />
          {t('lobbyNew.offline.title', 'Reconnecting...')}
        </div>
      )}

      {authMissing && (
        <div className="rounded-xl border border-[var(--border-2)] bg-[var(--surface-3)] px-3 py-2 text-[11px] text-[var(--text-2)]">
          {t('lobbyNew.auth.required', 'Open inside Telegram to play.')}
        </div>
      )}

      <QuickSeatCard
        recommendation={quickSeatRecommendation}
        fallbackLabel={quickSeatFallbackLabel}
        onQuickSeat={handleQuickSeat}
        onCreate={handleCreateTable}
        onJoinPrivate={handleJoinPrivate}
        onRefresh={refreshTables}
        disabled={!recommendedTable || actionsDisabled}
        actionsDisabled={actionsDisabled}
      />

      <LobbyTabs activeTab={activeTab} onChange={setActiveTab} labels={tabLabels} />

      <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-2)] p-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="absolute top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-3)]"
              style={{ insetInlineStart: '0.75rem' }}
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('lobbyNew.search.placeholder', 'Search tables')}
              className="w-full min-h-[44px] rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] pl-9 pr-3 text-[12px] text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-2 focus:ring-[var(--border-1)]"
              dir="auto"
            />
          </div>
          <SortMenu
            value={sort}
            options={sortOptions}
            onChange={setSort}
            label={t('lobbyNew.actions.sort', 'Sort')}
          />
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="group inline-flex min-h-[44px] items-center"
          >
            <span className="flex h-8 items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-3 text-[11px] font-semibold text-[var(--text-2)] transition group-active:scale-[0.97]">
              <FontAwesomeIcon icon={faSliders} className="text-[10px]" />
              {t('lobbyNew.actions.filters', 'Filters')}
            </span>
          </button>
          <span
            className="rounded-full border border-[var(--border-3)] bg-[var(--surface-3)] px-3 py-1 text-[11px] text-[var(--text-3)] tabular-nums"
            style={{ marginInlineStart: 'auto' }}
          >
            {listLoading
              ? t('common.loading', 'Loading...')
              : totalCount > 0
                ? `${visibleCount}/${totalCount}`
                : `${visibleCount}`}
          </span>
        </div>
      </div>

      {showSmallScopeHint && (
        <div className="rounded-xl border border-[var(--border-2)] bg-[var(--surface-3)] px-3 py-2 text-[11px] text-[var(--text-2)]">
          {t('lobbyNew.hint.smallScope', {
            defaultValue: 'Only {{count}} public tables available right now.',
            count: totalCount,
          })}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-2)] px-3 py-2 text-[12px] text-[var(--text-2)]">
          <p className="font-semibold text-[var(--text-1)]">
            {t('lobbyNew.history.title', 'Your tables')}
          </p>
          <p className="text-[11px] text-[var(--text-3)]">
            {t('lobbyNew.history.subtitle', 'Tables you have joined recently.')}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {activeError && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-2)] bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--text-2)]">
            <div>
              <p className="text-[12px] font-semibold text-[var(--text-1)]">
                {t('lobbyNew.error.title', 'Unable to load tables')}
              </p>
              <p className="text-[11px] text-[var(--text-3)]">{activeError}</p>
            </div>
            <button
              type="button"
              onClick={refreshTables}
              className="group inline-flex min-h-[36px] items-center"
            >
              <span className="flex h-7 items-center rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-3 text-[11px] font-semibold text-[var(--text-2)] transition group-active:scale-[0.97]">
                {t('common.actions.retry', 'Retry')}
              </span>
            </button>
          </div>
        )}

        {listLoading &&
          Array.from({ length: 6 }, (_, index) => <SkeletonRow key={`skeleton-${index}`} />)}

        {!listLoading && !activeError && listTables.length === 0 && (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description}
            actionLabel={emptyState.actionLabel}
            onAction={emptyState.onAction}
            actionDisabled={actionsDisabled}
          />
        )}

        {listTables.map((table) => (
          <TableCard
            key={table.id}
            table={table}
            isFavorite={favoriteSet.has(table.id)}
            onToggleFavorite={toggleFavorite}
            onJoin={handleJoinTable}
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
