import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

interface TableInfo {
  table_id: number
  mode: string
  status: string
  player_count: number
  max_players: number
  small_blind: number
  big_blind: number
  table_name: string | null
  host?: {
    user_id: number
    username?: string | null
    display_name?: string | null
  } | null
  created_at?: string | null
  is_full?: boolean
  is_private?: boolean
  is_public?: boolean
  visibility?: 'public' | 'private'
  viewer?: {
    is_seated?: boolean
    seat_position?: number | null
  } | null
}

interface ActiveTable {
  table_id: number
  mode: string
  status: string
  player_count: number
  max_players: number
  small_blind: number
  big_blind: number
  chips: number
  position: number
  table_name?: string | null
}

export default function LobbyPage() {
  const { t } = useTranslation()
  const { initData, ready } = useTelegram()
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [myTables, setMyTables] = useState<ActiveTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTables = async () => {
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
  }

  useEffect(() => {
    if (!ready) {
      return
    }
    fetchTables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, initData])

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
      {myTables.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">🎲 Your Active Tables</h2>
            <button
              onClick={fetchTables}
              className="text-sm font-medium text-blue-600 dark:text-blue-300"
            >
              {t('lobby.actions.refresh')}
            </button>
          </div>
          <div className="space-y-3">
            {myTables.map((table) => (
              <Link
                key={table.table_id}
                to={`/table/${table.table_id}`}
                state={{ from: '/lobby' }}
                className="flex flex-col rounded-xl border-2 border-emerald-200 bg-white p-4 shadow-sm hover:shadow-md transition dark:border-emerald-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {table.table_name || `Table #${table.table_id}`}
                  </span>
                  <span className="text-xs uppercase text-emerald-600 dark:text-emerald-300">
                    Your Seat: {table.position + 1}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <div>
                    <span className="block font-semibold">
                      {table.player_count} / {table.max_players}
                    </span>
                    <span>Players</span>
                  </div>
                  <div>
                    <span className="block font-semibold">
                      {table.small_blind}/{table.big_blind}
                    </span>
                    <span>Blinds</span>
                  </div>
                  <div>
                    <span className="block font-semibold">{table.chips}</span>
                    <span>Your Chips</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Available Tables */}
      <section className="space-y-3">
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
                    <span className="inline-flex h-6 items-center rounded-full bg-blue-100 px-3 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                      {resolveStatusLabel(table.status)}
                    </span>
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
