import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

const REFRESH_INTERVAL_MS = 20000

interface TableHostInfo {
  user_id: number
  username?: string | null
  display_name?: string | null
}

interface TableViewerState {
  is_seated?: boolean
  seat_position?: number | null
  chips?: number | null
  joined_at?: string | null
  is_creator?: boolean
}

interface TableInfo {
  table_id: number
  mode: string
  status: string
  player_count: number
  max_players: number
  small_blind: number
  big_blind: number
  table_name: string | null
  host?: TableHostInfo | null
  created_at?: string | null
  updated_at?: string | null
  starting_stack?: number
  is_full?: boolean
  is_private?: boolean
  is_public?: boolean
  visibility?: 'public' | 'private'
  viewer?: TableViewerState | null
  creator_user_id?: number | null
}

interface ActiveTable extends TableInfo {
  starting_stack: number
  viewer?: TableViewerState | null
}

export default function LobbyPage() {
  const { t } = useTranslation()
  const { initData, ready } = useTelegram()
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [myTables, setMyTables] = useState<ActiveTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTables = useCallback(async () => {
    if (!ready) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [tablesData, myTablesData] = await Promise.all([
        apiFetch<{ tables: TableInfo[] }>(
          '/tables',
          initData
            ? { initData, query: { scope: 'public' } }
            : { query: { scope: 'public' } },
        ),
        initData
          ? apiFetch<{ tables: ActiveTable[] }>('/users/me/tables', { initData })
          : Promise.resolve<{ tables: ActiveTable[] }>({ tables: [] }),
      ])

      setAvailableTables(tablesData.tables ?? [])
      setMyTables(myTablesData.tables ?? [])
    } catch (err) {
      console.error('Error fetching tables:', err)
      setError(t('lobby.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [initData, ready, t])

  useEffect(() => {
    if (!ready) {
      return
    }

    fetchTables()
    const interval = window.setInterval(fetchTables, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [ready, fetchTables])

  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  )

  const resolveStatusLabel = (status: string) => {
    const normalized = status.toLowerCase()
    const statusKeyMap: Record<string, string> = {
      waiting: 'waiting',
      active: 'running',
      running: 'running',
      paused: 'starting',
      starting: 'starting',
    }
    const key = statusKeyMap[normalized] || normalized
    return t(`lobby.status.${key}` as const, {
      defaultValue: status,
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-50 p-5 text-red-700 dark:bg-red-950/40 dark:text-red-200">
        <p>{error}</p>
        <button
          onClick={fetchTables}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          {t('lobby.actions.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('lobby.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('menu.lobby.description')}</p>
      </header>

      {/* My Active Tables */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">🎲 {t('lobby.myTables.title')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchTables}
              className="rounded-full border border-blue-100 px-3 py-1 text-sm font-medium text-blue-600 transition hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-900/40"
            >
              {t('lobby.actions.refresh')}
            </button>
          </div>
        </div>

        {myTables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300">
            <p>{t('lobby.myTables.empty')}</p>
            <div className="mt-4 flex flex-col gap-2 text-sm font-medium sm:flex-row sm:justify-center">
              <Link
                to="/games/create"
                className="rounded-full bg-blue-600 px-4 py-2 text-white shadow-sm transition hover:bg-blue-700"
              >
                {t('lobby.myTables.ctaCreate')}
              </Link>
              <a
                href="#public-tables"
                className="rounded-full border border-blue-200 px-4 py-2 text-blue-600 transition hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-900/40"
              >
                {t('lobby.myTables.ctaBrowse')}
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {myTables.map((table) => {
              const seatPosition = table.viewer?.seat_position ?? null
              const joinedAtText = table.viewer?.joined_at
                ? formatDate.format(new Date(table.viewer.joined_at))
                : null
              const stackAmount = table.viewer?.chips ?? table.starting_stack
              const statusLabel = resolveStatusLabel(table.status)
              const tableName = table.table_name || `Table #${table.table_id}`
              const isCreator = table.viewer?.is_creator ?? false

              return (
                <Link
                  key={table.table_id}
                  to={`/table/${table.table_id}`}
                  state={{ from: '/lobby' }}
                  className="flex flex-col rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-emerald-700 dark:bg-gray-800"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="block font-semibold text-gray-900 dark:text-gray-100">
                        {tableName}
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                          {statusLabel}
                        </span>
                        {isCreator && (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                            {t('lobby.labels.youHost')}
                          </span>
                        )}
                        {table.visibility && (
                          <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                            {t(`lobby.labels.visibility.${table.visibility}` as const)}
                          </span>
                        )}
                      </div>
                      {table.host?.display_name && !isCreator && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t('lobby.fields.host')}: {table.host.display_name}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-5">
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t('lobby.fields.players')}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {table.player_count} / {table.max_players}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t('lobby.fields.blinds')}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {table.small_blind}/{table.big_blind}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t('lobby.fields.stack')}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {stackAmount}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t('lobby.fields.seat')}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {seatPosition !== null ? seatPosition + 1 : '—'}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="block text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        {t('lobby.fields.joined')}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {joinedAtText || '—'}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Available Tables */}
      <section id="public-tables" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">🃏 Available Tables</h2>
          <button
            onClick={fetchTables}
            className="text-sm font-medium text-blue-600 dark:text-blue-300"
          >
            {t('lobby.actions.refresh')}
          </button>
        </div>
        <div className="space-y-3">
          {availableTables.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
              <p className="mb-2">{t('lobby.empty.public')}</p>
              <Link
                to="/group/invite"
                className="text-blue-600 dark:text-blue-300 hover:underline"
              >
                Create a private table →
              </Link>
            </div>
          ) : (
            availableTables.map((table) => {
              const createdAtText = table.created_at ? formatDate.format(new Date(table.created_at)) : null
              const isSeated = table.viewer?.is_seated
              const isCreator = table.viewer?.is_creator
              const cardMuted = table.is_full || Boolean(isSeated)

              return (
                <div
                  key={table.table_id}
                  className={`flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition dark:border-gray-700 dark:bg-gray-800 ${
                    cardMuted ? 'opacity-80' : ''
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="block text-base font-semibold text-gray-900 dark:text-gray-100">
                        {table.table_name || `Table #${table.table_id}`}
                      </span>
                      {table.host?.display_name && (
                        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                          {t('lobby.fields.host')}: {table.host.display_name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-6 items-center rounded-full bg-blue-100 px-3 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                        {resolveStatusLabel(table.status)}
                      </span>
                      {table.visibility && (
                        <span className="inline-flex h-6 items-center rounded-full bg-slate-200 px-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                          {t(`lobby.labels.visibility.${table.visibility}` as const)}
                        </span>
                      )}
                      {isCreator && (
                        <span className="inline-flex h-6 items-center rounded-full bg-amber-100 px-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                          {t('lobby.labels.youHost')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-4">
                    <div>
                      <span className="block font-semibold">
                        {table.player_count} / {table.max_players}
                      </span>
                      <span>{t('lobby.fields.players')}</span>
                    </div>
                    <div>
                      <span className="block font-semibold">
                        {table.small_blind}/{table.big_blind}
                      </span>
                      <span>{t('lobby.fields.blinds')}</span>
                    </div>
                    <div>
                      <span className="block font-semibold">
                        {table.is_full
                          ? t('lobby.labels.full')
                          : isSeated
                          ? t('lobby.labels.seated')
                          : t('lobby.labels.open')}
                      </span>
                      <span>{t('lobby.labels.seating')}</span>
                    </div>
                    <div>
                      <span className="block font-semibold">{createdAtText || '—'}</span>
                      <span>{t('lobby.fields.created')}</span>
                    </div>
                  </div>

                  <Link
                    to={`/table/${table.table_id}`}
                    state={{ from: '/lobby' }}
                    className={`mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      cardMuted
                        ? 'bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {isSeated ? t('lobby.actions.view') : t('lobby.actions.join')}
                  </Link>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
