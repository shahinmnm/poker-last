import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'

const highlightMetrics = [
  { key: 'handsPlayed', value: '128', trendKey: 'profile.highlights.trends.handsPlayed' },
  { key: 'winRate', value: '24%', trendKey: 'profile.highlights.trends.winRate' },
  { key: 'bestFinish', value: '1st', trendKey: 'profile.highlights.trends.bestFinish' },
]

const achievements = [
  { id: 'firstWin', labelKey: 'profile.achievements.items.firstWin', unlocked: true },
  { id: 'fiveInRow', labelKey: 'profile.achievements.items.fiveInRow', unlocked: false },
  { id: 'collector', labelKey: 'profile.achievements.items.collector', unlocked: false },
]

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user } = useTelegram()

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
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {t('profile.playerSince', { date: '2023' })}
        </p>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('profile.highlights.title')}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {highlightMetrics.map((metric) => (
            <div
              key={metric.key}
              className="rounded-xl border border-slate-200 p-4 dark:border-gray-700"
            >
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
                {t(`profile.highlights.${metric.key}`)}
              </p>
              <p className="mt-2 text-xl font-semibold">{metric.value}</p>
              {metric.trendKey && (
                <p className="mt-1 text-xs text-emerald-500 dark:text-emerald-300">
                  {t(metric.trendKey)}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="achievements" className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('profile.achievements.title')}</h2>
        <div className="mt-3 space-y-3">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-gray-700"
            >
              <span>{t(achievement.labelKey)}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  achievement.unlocked
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {achievement.unlocked
                  ? t('profile.achievements.unlocked')
                  : t('profile.achievements.locked')}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t('profile.achievements.empty')}</p>
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
