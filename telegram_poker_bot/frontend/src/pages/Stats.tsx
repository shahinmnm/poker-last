import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartLine, faArrowTrendUp, faArrowTrendDown, faHandFist, faTableCellsLarge, faTrophy, faCoins, faArrowLeft } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { useUserData } from '../providers/UserDataProvider'
import { apiFetch } from '../utils/apiClient'

interface GameHistory {
  table_id: number
  mode: string
  joined_at: string
  left_at: string
  starting_chips: number
  ending_chips: number
  profit: number
  small_blind: number
  big_blind: number
}

export default function StatsPage() {
  const { t } = useTranslation()
  const { initData } = useTelegram()
  const { stats, loading: statsLoading } = useUserData()
  const [history, setHistory] = useState<GameHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      if (!initData) {
        return
      }

      try {
        setHistoryLoading(true)
        setError(null)

        const historyData = await apiFetch<{ games: GameHistory[] }>('/users/me/history', { initData })
        setHistory(historyData.games)
      } catch (err) {
        console.error('Error fetching history data:', err)
        setError('Failed to load history')
      } finally {
        setHistoryLoading(false)
      }
    }

    fetchHistory()
  }, [initData])

  const loading = statsLoading || historyLoading

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
      </div>
    )
  }

  const hasPlayedGames = stats && stats.hands_played > 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <FontAwesomeIcon icon={faChartLine} />
          {t('stats.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {hasPlayedGames ? t('stats.subtitle') : 'Play some games to see your statistics!'}
        </p>
      </header>

      {hasPlayedGames && stats ? (
        <>
          <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
            <h2 className="text-lg font-semibold">{t('profile.highlights.title')}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <FontAwesomeIcon icon={faHandFist} className="text-sm" />
                  Hands Played
                </p>
                <p className="mt-2 text-xl font-semibold">{stats.hands_played}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <FontAwesomeIcon icon={faTrophy} className="text-sm" />
                  Win Rate
                </p>
                <p className="mt-2 text-xl font-semibold">{stats.win_rate.toFixed(1)}%</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <FontAwesomeIcon icon={stats.total_profit >= 0 ? faArrowTrendUp : faArrowTrendDown} className="text-sm" />
                  Total Profit
                </p>
                <p
                  className={`mt-2 text-xl font-semibold ${
                    stats.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stats.total_profit >= 0 ? '+' : ''}
                  {stats.total_profit.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <FontAwesomeIcon icon={faTableCellsLarge} className="text-sm" />
                  Tables Played
                </p>
                <p className="mt-2 text-xl font-semibold">{stats.tables_played}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
                <p className="text-xs uppercase text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <FontAwesomeIcon icon={faCoins} className="text-sm" />
                  Biggest Pot
                </p>
                <p className="mt-2 text-xl font-semibold">{stats.biggest_pot.toLocaleString()}</p>
              </div>
            </div>
          </section>

          {history.length > 0 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
              <h2 className="text-lg font-semibold">Recent Games</h2>
              <div className="mt-4 space-y-3">
                {history.map((game, index) => (
                  <div
                    key={`${game.table_id}-${index}`}
                    className="rounded-xl border border-slate-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          Table #{game.table_id} • {game.mode}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {game.small_blind}/{game.big_blind} blinds
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold flex items-center gap-1 ${
                            game.profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          <FontAwesomeIcon icon={game.profit >= 0 ? faArrowTrendUp : faArrowTrendDown} className="text-sm" />
                          {game.profit >= 0 ? '+' : ''}
                          {game.profit.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(game.left_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
          <FontAwesomeIcon icon={faChartLine} className="text-4xl mb-2 text-gray-400" />
          <p>Play some games to see your statistics here!</p>
        </section>
      )}

      <Link
        to="/profile"
        className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
        {t('menu.profile.label')}
      </Link>
    </div>
  )
}
