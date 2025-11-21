import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUser,
  faCoins,
  faTrophy,
  faChartLine,
  faLanguage,
  faVolumeHigh,
  faPalette,
  faCircleQuestion,
  faChevronRight,
  faMedal,
  faLock,
} from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'

interface UserStats {
  hands_played: number
  tables_played: number
  total_profit: number
  win_rate: number
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, initData } = useTelegram()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!initData) return

      try {
        setLoading(true)
        const [statsData, balanceData] = await Promise.all([
          apiFetch<UserStats>('/users/me/stats', { initData }),
          apiFetch<{ balance: number }>('/users/me/balance', { initData }),
        ])
        setStats(statsData)
        setBalance(balanceData.balance)
      } catch (err) {
        console.error('Error fetching profile data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProfileData()
  }, [initData])

  if (loading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center rounded-2xl"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl p-6"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-xl"
            style={{
              background: 'var(--glass-bg-elevated)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <FontAwesomeIcon icon={faUser} className="text-2xl" style={{ color: 'var(--color-text)' }} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              {user?.first_name} {user?.last_name}
            </h1>
            {user?.username && (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                @{user.username}
              </p>
            )}
          </div>
          <button
            disabled
            className="rounded-xl px-3 py-2 text-xs font-medium opacity-50 cursor-not-allowed"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text)',
            }}
          >
            {t('profile.edit', 'Edit')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          {
            icon: faTrophy,
            label: t('profile.stats.games', 'Games'),
            value: stats?.hands_played || 0,
          },
          {
            icon: faChartLine,
            label: t('profile.stats.winRate', 'Win Rate'),
            value: stats ? `${stats.win_rate.toFixed(1)}%` : '0%',
          },
          {
            icon: faCoins,
            label: t('profile.stats.profit', 'Profit'),
            value: stats?.total_profit !== undefined
              ? (stats.total_profit >= 0 ? `+${stats.total_profit}` : stats.total_profit)
              : '0',
            color: stats && stats.total_profit >= 0 ? 'var(--color-success-text)' : 'var(--color-danger)',
          },
          {
            icon: faCoins,
            label: t('profile.balance', 'Balance'),
            value: balance.toLocaleString(),
            color: 'var(--color-accent)',
          },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="rounded-xl p-4"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <FontAwesomeIcon
              icon={stat.icon}
              className="mb-2 text-lg"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {stat.label}
            </p>
            <p
              className="mt-1 text-lg font-bold"
              style={{ color: stat.color || 'var(--color-text)' }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('profile.achievements.title', 'Achievements')}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('profile.achievements.firstWin', 'First Win'), locked: true },
            { label: t('profile.achievements.bigPot', 'Big Pot'), locked: true },
            { label: t('profile.achievements.streak', 'Streak'), locked: true },
          ].map((badge, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center gap-2 rounded-xl p-3"
              style={{
                background: 'var(--glass-bg-elevated)',
                border: '1px solid var(--glass-border)',
                opacity: badge.locked ? 0.5 : 1,
              }}
            >
              <FontAwesomeIcon
                icon={badge.locked ? faLock : faMedal}
                className="text-xl"
                style={{ color: 'var(--color-text-muted)' }}
              />
              <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                {badge.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('profile.settings.title', 'Settings')}
        </h2>
        <div className="space-y-2">
          {[
            { icon: faLanguage, label: t('profile.settings.language', 'Language'), path: '/settings' },
            { icon: faVolumeHigh, label: t('profile.settings.sound', 'Sound'), path: null },
            { icon: faPalette, label: t('profile.settings.theme', 'Theme'), path: null },
            { icon: faCircleQuestion, label: t('profile.settings.help', 'Help'), path: '/help' },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => item.path && navigate(item.path)}
              disabled={!item.path}
              className="flex w-full items-center justify-between rounded-xl p-3 text-left transition-transform active:scale-98"
              style={{
                background: 'var(--glass-bg-elevated)',
                border: '1px solid var(--glass-border)',
                opacity: item.path ? 1 : 0.5,
                cursor: item.path ? 'pointer' : 'not-allowed',
              }}
            >
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={item.icon} style={{ color: 'var(--color-text-muted)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  {item.label}
                </span>
              </div>
              {item.path && (
                <FontAwesomeIcon icon={faChevronRight} style={{ color: 'var(--color-text-muted)' }} />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
