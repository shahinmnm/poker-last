import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

interface UserStats {
  hands_played: number
  tables_played: number
  total_profit: number
  biggest_pot: number
  win_rate: number
  first_game_date: string | null
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user, initData } = useTelegram()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!initData) {
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Fetch stats and balance in parallel
        const [statsData, balanceData] = await Promise.all([
          apiFetch<UserStats>('/users/me/stats', { initData }),
          apiFetch<{ balance: number }>('/users/me/balance', { initData }),
        ])

        setStats(statsData)
        setBalance(balanceData.balance)
      } catch (err) {
        console.error('Error fetching profile data:', err)
        setError('Failed to load profile data')
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
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
      </div>
    )
  }

  const hasPlayedGames = stats && stats.hands_played > 0

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('profile.subtitle')}</p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {user?.first_name} {user?.last_name}
            </h2>
            {user?.username && (
              <p className="text-sm text-gray-500 dark:text-gray-400">@{user.username}</p>
            )}
          </div>
          <Link
            to="/profile/stats"
            className="rounded-lg border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/40"
          >
            {t('profile.actions.viewStats')}
          </Link>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Balance</p>
            <p className="text-xl font-bold">{balance.toLocaleString()} chips</p>
          </div>
        </div>
        {stats?.first_game_date && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            {t('profile.playerSince', {
              date: new Date(stats.first_game_date).getFullYear(),
            })}
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('profile.highlights.title')}</h2>
        {hasPlayedGames ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
                {t('profile.highlights.handsPlayed')}
              </p>
              <p className="mt-2 text-xl font-semibold">{stats!.hands_played}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
                {t('profile.highlights.winRate')}
              </p>
              <p className="mt-2 text-xl font-semibold">{stats!.win_rate.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-gray-700">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
                {t('profile.highlights.totalProfit')}
              </p>
              <p
                className={`mt-2 text-xl font-semibold ${
                  stats!.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {stats!.total_profit >= 0 ? '+' : ''}
                {stats!.total_profit.toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Play some games to see your stats!
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('menu.wallet.label')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {t('menu.wallet.description')}
        </p>
        <Link
          to="/wallet"
          className="mt-4 inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          {t('common.actions.view')}
        </Link>
      </section>
    </div>
  )
}
