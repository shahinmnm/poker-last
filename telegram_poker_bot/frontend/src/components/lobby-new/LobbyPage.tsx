import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCheck,
  faMagnifyingGlass,
  faSliders,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'

import LobbyHeader from './LobbyHeader'
import QuickSeatCard from './QuickSeatCard'
import LobbyTabs, { type LobbyTabKey } from './LobbyTabs'
import TableCard from './TableCard'
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
  const filterButtonRef = useRef<HTMLButtonElement | null>(null)
  const filterPopoverRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<LobbyTabKey>('cash')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<LobbyFilters>(defaultLobbyFilters)
  const [sort, setSort] = useState<LobbySort>('seats_available')
  const [filterOpen, setFilterOpen] = useState(false)
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => readStorage(FAVORITES_KEY, []))
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [isCompact, setIsCompact] = useState(false)
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
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 700px)')
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches)
    }
    setIsCompact(media.matches)
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!filterOpen) return
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node
      if (filterPopoverRef.current?.contains(target)) return
      if (filterButtonRef.current?.contains(target)) return
      setFilterOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [filterOpen])

  useEffect(() => {
    writeStorage(FAVORITES_KEY, favoriteIds)
  }, [favoriteIds])

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

        if (filters.joinableOnly && table.players >= table.maxPlayers) return false
        if (filters.favoritesOnly && !favoriteSet.has(table.id)) return false

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
            if (seatsB !== seatsA) return seatsB - seatsA
            return b.players - a.players
          })
          break
        case 'most_players':
          sorted.sort((a, b) => b.players - a.players)
          break
        default:
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
      { value: 'seats_available' as LobbySort, label: t('lobbyNew.sort.seatsAvailable', 'Seats available') },
      { value: 'stakes_high' as LobbySort, label: t('lobbyNew.sort.stakesHigh', 'Stakes high to low') },
      { value: 'most_players' as LobbySort, label: t('lobbyNew.sort.mostPlayers', 'Most players') },
    ],
    [t],
  )

  const activeFilterCount =
    Number(filters.joinableOnly) +
    Number(filters.favoritesOnly) +
    Number(sort !== 'seats_available')

  const tabLabels = useMemo(
    () => ({
      cash: isCompact
        ? t('lobbyNew.tabs.cashShort', 'Cash')
        : t('lobbyNew.tabs.cash', 'Cash Tables'),
      headsUp: isCompact
        ? t('lobbyNew.tabs.headsUpShort', 'HU')
        : t('lobbyNew.tabs.headsUp', 'Heads-Up'),
      private: isCompact
        ? t('lobbyNew.tabs.privateShort', 'Private')
        : t('lobbyNew.tabs.private', 'Private'),
      history: isCompact
        ? t('lobbyNew.tabs.historyShort', 'Hist')
        : t('lobbyNew.tabs.history', 'History'),
    }),
    [isCompact, t],
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


  const actionsDisabled = !ready
  const activeError =
    !ready || authMissing ? null : activeTab === 'history' ? errorMyTables : errorPublic
  const lobbyStatusLabel = listLoading
    ? t('common.loading', 'Loading...')
    : t('lobbyNew.header.tablesCount', {
        defaultValue: '{{count}} tables',
        count: totalCount,
      })

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

  const formatPreviewStakes = useCallback(
    (table: TableSummary) => {
      if (
        typeof table.stakesSmall === 'number' &&
        typeof table.stakesBig === 'number' &&
        Number.isFinite(table.stakesSmall) &&
        Number.isFinite(table.stakesBig) &&
        table.stakesSmall > 0 &&
        table.stakesBig > 0
      ) {
        const symbol = table.currency === 'USD' ? '$' : ''
        return `${symbol}${formatChips(table.stakesSmall)}/${symbol}${formatChips(table.stakesBig)}`
      }
      return t('lobbyNew.table.stakesUnknown', 'Blinds --')
    },
    [t],
  )

  const myTablePreview = filteredMyTables.slice(0, 2)

  return (
    <div className="lobby-screen">
      <div className="lobby-shell page-stack">
        <LobbyHeader statusLabel={lobbyStatusLabel} />

        <div className="lobby-grid">
          <div className="lobby-column lobby-column--primary">
            {isOffline && (
              <div className="ui-pill lobby-banner">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-[10px]" />
                {t('lobbyNew.offline.title', 'Reconnecting...')}
              </div>
            )}

            {authMissing && (
              <div className="ui-pill lobby-banner">
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

            <div className="your-tables-card">
              <div className="section-header">
                <div>
                  <p className="section-eyebrow">{t('lobbyNew.history.title', 'Your tables')}</p>
                  <p className="section-sub">
                    {t('lobbyNew.history.subtitle', 'Active or recent seats appear here.')}
                  </p>
                </div>
                <button
                  type="button"
                  className="section-action ui-pill"
                  onClick={() => setActiveTab('history')}
                >
                  {t('lobbyNew.history.viewAll', 'See all')}
                </button>
              </div>

              <div className="your-tables-list">
                {loadingMyTables &&
                  Array.from({ length: 2 }, (_, index) => <SkeletonRow key={`my-skeleton-${index}`} />)}

                {!loadingMyTables && myTablePreview.length === 0 && (
                  <div className="your-tables-empty ui-muted">
                    {t('lobbyNew.history.empty', 'No active tables yet')}
                  </div>
                )}

                {myTablePreview.map((table) => (
                  <button
                    key={`mytable-${table.id}`}
                    type="button"
                    className="your-table-row"
                    onClick={() => handleJoinTable(table)}
                  >
                    <div className="your-table-row__main">
                      <p className="your-table-row__name" dir="auto">
                        {table.name}
                      </p>
                      <span className="your-table-row__stakes">{formatPreviewStakes(table)}</span>
                    </div>
                    <div className="your-table-row__meta">
                      <span className="your-table-row__pill tabular-nums">
                        {table.players}/{table.maxPlayers}
                      </span>
                      {table.status && (
                        <span className="your-table-row__status" dir="auto">
                          {table.status}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lobby-column lobby-column--list">
            <div className="lobby-browse">
              <div className="lobby-browse__row lobby-toolbar">
                <LobbyTabs activeTab={activeTab} onChange={setActiveTab} labels={tabLabels} />

                <div className="lobby-search-wrap">
                  <div className="lobby-search">
                    <FontAwesomeIcon
                      icon={faMagnifyingGlass}
                      className="lobby-search__icon"
                      aria-hidden
                    />
                    <input
                      type="text"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t('lobbyNew.search.placeholder', 'Search tables')}
                      className="lobby-search__input"
                      dir="auto"
                    />
                  </div>

                  <div className="lobby-filter-group">
                    <div className="relative">
                      <button
                        ref={filterButtonRef}
                        type="button"
                        onClick={() => setFilterOpen((prev) => !prev)}
                        className="lobby-filter-button"
                        aria-expanded={filterOpen}
                        aria-haspopup="dialog"
                      >
                        <FontAwesomeIcon icon={faSliders} className="text-[11px]" />
                        <span className="lobby-filter-label">
                          {t('lobbyNew.actions.filters', 'Filters')}
                        </span>
                        {activeFilterCount > 0 && (
                          <span className="lobby-filter-indicator" aria-label={t('lobbyNew.filters.active', 'Active filters')}>
                            {activeFilterCount}
                          </span>
                        )}
                      </button>

                      {filterOpen && (
                        <div ref={filterPopoverRef} className="lobby-filter-popover">
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                              {t('lobbyNew.filters.title', 'Filters')}
                            </p>
                            <button
                              type="button"
                              onClick={() => setFilters((prev) => ({ ...prev, joinableOnly: !prev.joinableOnly }))}
                              aria-pressed={filters.joinableOnly}
                              className="lobby-filter-toggle"
                            >
                              <span className="text-[12px] font-medium text-[var(--text-2)]">
                                {t('lobbyNew.filters.joinableOnly', 'Only joinable')}
                              </span>
                              <span
                                className={`lobby-filter-switch ${filters.joinableOnly ? 'is-active' : ''}`}
                                aria-hidden="true"
                              >
                                <span className="lobby-filter-thumb" />
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
                              aria-pressed={filters.favoritesOnly}
                              className="lobby-filter-toggle"
                            >
                              <span className="text-[12px] font-medium text-[var(--text-2)]">
                                {t('lobbyNew.filters.favoritesOnly', 'Favorites')}
                              </span>
                              <span
                                className={`lobby-filter-switch ${filters.favoritesOnly ? 'is-active' : ''}`}
                                aria-hidden="true"
                              >
                                <span className="lobby-filter-thumb" />
                              </span>
                            </button>
                          </div>
                          <div className="mt-3 border-t border-[var(--border-3)] pt-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-3)]">
                              {t('lobbyNew.sort.title', 'Sort')}
                            </p>
                            <div className="mt-2 space-y-1">
                              {sortOptions.map((option) => {
                                const isActive = option.value === sort
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setSort(option.value)}
                                    className={`lobby-filter-option ${isActive ? 'is-active' : ''}`}
                                    style={{ textAlign: 'start' }}
                                  >
                                    <span dir="auto">{option.label}</span>
                                    {isActive && <FontAwesomeIcon icon={faCheck} className="text-[var(--chip-emerald)]" />}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="lobby-count-pill tabular-nums">
                      {listLoading
                        ? t('common.loading', 'Loading...')
                        : totalCount > 0
                          ? `${visibleCount}/${totalCount}`
                          : `${visibleCount}`}
                    </span>
                  </div>
                </div>
              </div>

              {showSmallScopeHint && (
                <div className="lobby-scope-hint ui-pill">
                  {t('lobbyNew.hint.smallScope', {
                    defaultValue: 'Only {{count}} public tables available right now.',
                    count: totalCount,
                  })}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="lobby-info ui-muted">
                  <p className="font-semibold text-[var(--text-1)]">
                    {t('lobbyNew.history.title', 'Your tables')}
                  </p>
                  <p className="text-[11px] text-[var(--text-3)]">
                    {t('lobbyNew.history.subtitle', 'Tables you have joined recently.')}
                  </p>
                </div>
              )}

              <div className="lobby-list" role="list">
                {activeError && (
                  <div className="lobby-error ui-panel">
                    <div>
                      <p className="text-[12px] font-semibold text-[var(--text-1)]">
                        {t('lobbyNew.error.title', 'Unable to load tables')}
                      </p>
                      <p className="text-[11px] text-[var(--text-3)]">{activeError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={refreshTables}
                      className="ui-pill lobby-error__action"
                    >
                      {t('common.actions.retry', 'Retry')}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
