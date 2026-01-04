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

  const listTables = activeTab === 'history' ? filteredMyTables : filteredTables
  const listLoading =
    !ready ||
    (activeTab === 'history'
      ? loadingMyTables
      : loadingPublic || refreshingPublic)
  const totalCount = activeTab === 'history' ? myTables.length : publicTables.length
  const visibleCount = listTables.length

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
      cash: t('lobbyNew.tabs.cashShort', 'Cash'),
      headsUp: t('lobbyNew.tabs.headsUpShort', 'HU'),
      private: t('lobbyNew.tabs.privateShort', 'Private'),
      history: t('lobbyNew.tabs.historyShort', 'History'),
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


  const actionsDisabled = !ready
  const activeError =
    !ready || authMissing ? null : activeTab === 'history' ? errorMyTables : errorPublic
  const lobbyStatusLabel =
    !ready || loadingPublic
      ? t('common.loading', 'Loading...')
      : t('lobbyNew.header.tablesOnlineCount', {
          defaultValue: '{{count}}',
          count: publicTables.length,
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

  return (
    <div className="lobby-v2">
      {/* 1. Safe Header - Fixed 44px max */}
      <LobbyHeader statusLabel={lobbyStatusLabel} />

      {/* Banners */}
      {isOffline && (
        <div className="lobby-v2__banner">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
          <span className="ui-nowrap">{t('lobbyNew.offline.title', 'Reconnecting...')}</span>
        </div>
      )}

      {authMissing && (
        <div className="lobby-v2__banner">
          <span className="ui-nowrap">
            {t('lobbyNew.auth.required', 'Open inside Telegram to play.')}
          </span>
        </div>
      )}

      {/* 2 & 3. Play Now Hero + Secondary Actions */}
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

      {/* 4. Lobby Controls Row */}
      <section className="lobby-v2__controls">
        <LobbyTabs activeTab={activeTab} onChange={setActiveTab} labels={tabLabels} />

        <div className="lobby-v2__search-row">
          <div className="lobby-v2__search">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="lobby-v2__search-icon" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('lobbyNew.search.placeholder', 'Search tables')}
              className="lobby-v2__search-input ui-nowrap"
            />
          </div>

          <div className="lobby-v2__filter-wrap">
            <button
              ref={filterButtonRef}
              type="button"
              onClick={() => setFilterOpen((prev) => !prev)}
              className="lobby-v2__filter-btn"
              aria-expanded={filterOpen}
              aria-label={t('lobbyNew.actions.filters', 'Filters')}
            >
              <FontAwesomeIcon icon={faSliders} />
              {activeFilterCount > 0 && (
                <span className="lobby-v2__filter-count">{activeFilterCount}</span>
              )}
            </button>

            {filterOpen && (
              <div ref={filterPopoverRef} className="lobby-v2__filter-popover">
                <p className="lobby-v2__filter-title">{t('lobbyNew.filters.title', 'Filters')}</p>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, joinableOnly: !prev.joinableOnly }))}
                  aria-pressed={filters.joinableOnly}
                  className="lobby-v2__filter-toggle"
                >
                  <span className="ui-nowrap">{t('lobbyNew.filters.joinableOnly', 'Only joinable')}</span>
                  <span className={`lobby-v2__toggle ${filters.joinableOnly ? 'is-on' : ''}`}>
                    <span className="lobby-v2__toggle-thumb" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
                  aria-pressed={filters.favoritesOnly}
                  className="lobby-v2__filter-toggle"
                >
                  <span className="ui-nowrap">{t('lobbyNew.filters.favoritesOnly', 'Favorites')}</span>
                  <span className={`lobby-v2__toggle ${filters.favoritesOnly ? 'is-on' : ''}`}>
                    <span className="lobby-v2__toggle-thumb" />
                  </span>
                </button>

                <div className="lobby-v2__filter-divider" />
                <p className="lobby-v2__filter-title">{t('lobbyNew.sort.title', 'Sort')}</p>
                {sortOptions.map((option) => {
                  const isActive = option.value === sort
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSort(option.value)}
                      className={`lobby-v2__sort-option ${isActive ? 'is-active' : ''}`}
                    >
                      <span className="ui-nowrap">{option.label}</span>
                      {isActive && <FontAwesomeIcon icon={faCheck} />}
                    </button>
                  )
                })}
              </div>
            )}

            <span className="lobby-v2__count ui-nowrap">{visibleCount}/{totalCount}</span>
          </div>
        </div>
      </section>

      {/* 6. Table List */}
      <div className="lobby-v2__list" role="list">
        {activeError && (
          <div className="lobby-v2__error">
            <div>
              <p className="lobby-v2__error-title">{t('lobbyNew.error.title', 'Unable to load tables')}</p>
              <p className="lobby-v2__error-text">{activeError}</p>
            </div>
            <button type="button" onClick={refreshTables} className="lobby-v2__error-btn">
              {t('common.actions.retry', 'Retry')}
            </button>
          </div>
        )}

        {listLoading &&
          Array.from({ length: 5 }, (_, index) => <SkeletonRow key={`skeleton-${index}`} />)}

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

      {/* 7. Recent Tables (only in history tab context) */}
      {activeTab === 'history' && filteredMyTables.length > 0 && (
        <div className="lobby-v2__recent">
          <p className="lobby-v2__recent-title">{t('lobbyNew.history.title', 'Your tables')}</p>
        </div>
      )}
    </div>
  )
}
