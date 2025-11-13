import { useState, useEffect } from 'react'
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
  table_name: string
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
}

export default function LobbyPage() {
  const { t } = useTranslation()
  const { initData } = useTelegram()
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [myTables, setMyTables] = useState<ActiveTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTables = async () => {
    if (!initData) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const [tablesData, myTablesData] = await Promise.all([
        apiFetch<{ tables: TableInfo[] }>('/tables', { initData }),
        apiFetch<{ tables: ActiveTable[] }>('/users/me/tables', { initData }),
      ])

      setAvailableTables(tablesData.tables)
      setMyTables(myTablesData.tables)
    } catch (err) {
      console.error('Error fetching tables:', err)
      setError('Failed to load tables')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTables()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData])

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
          Retry
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
              Refresh
            </button>
          </div>
          <div className="space-y-3">
            {myTables.map((table) => (
              <Link
                key={table.table_id}
                to={`/table/${table.table_id}`}
                className="flex flex-col rounded-xl border-2 border-emerald-200 bg-white p-4 shadow-sm hover:shadow-md transition dark:border-emerald-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Table #{table.table_id}</span>
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
            Refresh
          </button>
        </div>
        <div className="space-y-3">
          {availableTables.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
              <p className="mb-2">No public tables available right now.</p>
              <Link
                to="/group/invite"
                className="text-blue-600 dark:text-blue-300 hover:underline"
              >
                Create a private table →
              </Link>
            </div>
          ) : (
            availableTables.map((table) => (
              <div
                key={table.table_id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">
                    {table.table_name || `Table #${table.table_id}`}
                  </span>
                  <span className="text-xs uppercase text-blue-600 dark:text-blue-300">
                    {table.mode}
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
                    <span className="block font-semibold capitalize">{table.status}</span>
                    <span>Status</span>
                  </div>
                </div>
                <button className="mt-3 rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
                  Join Table
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
