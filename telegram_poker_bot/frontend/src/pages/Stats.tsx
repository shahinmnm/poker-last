import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartLine, faArrowTrendUp, faArrowTrendDown, faHandFist, faTableCellsLarge, faTrophy, faCoins, faArrowLeft, faClock } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { useUserData } from '../providers/UserDataProvider'
import { apiFetch } from '../utils/apiClient'
import { extractRuleSummary } from '../utils/tableRules'
import type { TableTemplateInfo } from '../components/lobby/types'

interface GameHistory {
  table_id: number
  mode: string
  joined_at: string
  left_at: string
  starting_chips: number
  ending_chips: number
  profit: number
  table_name?: string | null
  template?: TableTemplateInfo | null
  currency_type?: string
  max_players?: number
}

interface HandHistoryWinner {
  user_id: number
  amount: number
  hand_rank: string
  best_hand_cards: string[]
}

interface HandHistoryItem {
  hand_no: number
  table_id: number
  board: string[]
  winners: HandHistoryWinner[]
  pot_total: number
  created_at: string | null
}

const HAND_RANK_LABEL: Record<string, string> = {
  high_card: 'High Card',
  pair: 'Pair',
  two_pair: 'Two Pair',
  three_of_a_kind: 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
  full_house: 'Full House',
  four_of_a_kind: 'Four of a Kind',
  straight_flush: 'Straight Flush',
}

export default function StatsPage() {
  const { t } = useTranslation()
  const { initData } = useTelegram()
  const { stats, loading: statsLoading } = useUserData()
  const [history, setHistory] = useState<GameHistory[]>([])
  const [recentHands, setRecentHands] = useState<HandHistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [handsLoading, setHandsLoading] = useState(true)
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

  useEffect(() => {
    const fetchHands = async () => {
      if (!initData) {
        return
      }

      try {
        setHandsLoading(true)

        const handsData = await apiFetch<{ hands: HandHistoryItem[] }>('/users/me/hands?limit=5', { initData })
        setRecentHands(handsData.hands)
      } catch (err) {
        console.error('Error fetching hands data:', err)
      } finally {
        setHandsLoading(false)
      }
    }

    fetchHands()
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

          {!handsLoading && recentHands.length > 0 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FontAwesomeIcon icon={faClock} />
                {t('table.recentHands.title')}
              </h2>
              <div className="mt-4 space-y-3">
                {recentHands.map((hand) => (
                  <div
                    key={`${hand.table_id}-${hand.hand_no}`}
                    className="rounded-xl border border-slate-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">
                          {t('table.recentHands.handNo', { number: hand.hand_no })} • Table #{hand.table_id}
                        </p>
                        {hand.board.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('table.recentHands.board')}: {hand.board.join(' ')}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                          {t('table.recentHands.pot')}: {hand.pot_total}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {hand.winners.map((winner, idx) => {
                        // Note: We don't have direct user_id in stats, so we can't highlight the current user
                        // This would require adding user info to the stats or passing it separately
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-gray-600 dark:text-gray-400">
                              Player #{winner.user_id} • {HAND_RANK_LABEL[winner.hand_rank] || winner.hand_rank}
                            </span>
                            <span className="text-gray-500">
                              +{winner.amount}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
              <h2 className="text-lg font-semibold">Recent Games</h2>
              <div className="mt-4 space-y-3">
                {history.map((game, index) => {
                  const rules = extractRuleSummary(game.template, {
                    table_name: game.table_name ?? null,
                    max_players: game.max_players,
                    currency_type: game.currency_type,
                  })
                  const tableLabel = rules.tableName || `Table #${game.table_id}`
                  const stakesLabel = rules.stakesLabel || '—'

                  return (
                  <div
                    key={`${game.table_id}-${index}`}
                    className="rounded-xl border border-slate-200 p-4 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">
                          {tableLabel} • {game.mode}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {stakesLabel}
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
                  )
                })}
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
