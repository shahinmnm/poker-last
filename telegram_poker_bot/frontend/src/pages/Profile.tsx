import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins, faChartLine, faWallet } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'
import Avatar from '../components/ui/Avatar'
import Card from '../components/ui/Card'

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
      {/* Avatar & Profile Header */}
      <Card padding="lg">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <span 
              className="absolute inset-[-6px] rounded-full blur-lg" 
              style={{ background: 'var(--glow-primary)' }}
              aria-hidden 
            />
            <Avatar size="xl" className="relative" />
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
            {user?.first_name} {user?.last_name}
          </h1>
          {user?.username && (
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>@{user.username}</p>
          )}
          <div 
            className="mt-4 flex items-center gap-3 px-6 py-3 rounded-full"
            style={{
              background: 'var(--bg-glass)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--color-border-glass)',
              boxShadow: 'var(--shadow-accent-glow)',
            }}
          >
            <FontAwesomeIcon icon={faCoins} className="text-3xl" style={{ color: 'var(--accent-green)' }} />
            <div>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('profile.balance')}</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--accent-green)' }}>
                {balance.toLocaleString()}
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t('profile.chips')}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Card */}
      <Card padding="lg">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          {t('profile.highlights.title')}
        </h2>
        {hasPlayedGames ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <div 
              className="relative rounded-xl p-4"
              style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--color-border-glass)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <p className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>
                {t('profile.highlights.handsPlayed')}
              </p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--color-text)' }}>
                {stats!.hands_played}
              </p>
            </div>
            <div 
              className="relative rounded-xl p-4"
              style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--color-border-glass)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <p className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>
                {t('profile.highlights.winRate')}
              </p>
              <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--accent-green)' }}>
                {stats!.win_rate.toFixed(1)}%
              </p>
            </div>
            <div 
              className="relative rounded-xl p-4"
              style={{
                background: 'var(--bg-glass)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid var(--color-border-glass)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              <p className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>
                {t('profile.highlights.totalProfit')}
              </p>
              <p
                className="mt-2 text-2xl font-semibold"
                style={{ 
                  color: stats!.total_profit >= 0 ? 'var(--accent-green)' : 'var(--color-danger)'
                }}
              >
                {stats!.total_profit >= 0 ? '+' : ''}
                {stats!.total_profit.toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {t('profile.noGamesYet')}
          </p>
        )}
        {stats?.first_game_date && (
          <p className="mt-4 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            {t('profile.playerSince', {
              date: new Date(stats.first_game_date).getFullYear(),
            })}
          </p>
        )}
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/profile/stats"
          className="app-button app-button--secondary app-button--lg flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon={faChartLine} />
          <span>{t('profile.actions.viewStats')}</span>
        </Link>
        <Link
          to="/wallet"
          className="app-button app-button--primary app-button--lg flex items-center justify-center gap-2"
        >
          <FontAwesomeIcon icon={faWallet} />
          <span>{t('menu.wallet.label')}</span>
        </Link>
      </div>
    </div>
  )
}
