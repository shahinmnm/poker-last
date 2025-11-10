import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function StatsPage() {
  const { t } = useTranslation()

  const sampleData = [
    { label: t('profile.highlights.handsPlayed'), value: '128', detail: t('stats.samples.period') },
    { label: t('profile.highlights.winRate'), value: '24%', detail: t('stats.samples.mode') },
    { label: t('stats.samples.ev'), value: '+1.8', detail: t('stats.samples.overall') },
  ]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t('stats.title')}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('stats.comingSoon')}</p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('profile.highlights.title')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {sampleData.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 p-4 dark:border-gray-700"
            >
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">{item.detail}</p>
              <p className="mt-2 text-xl font-semibold">{item.value}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
        {t('stats.comingSoon')}
      </section>

      <Link
        to="/profile"
        className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
      >
        ← {t('menu.profile.label')}
      </Link>
    </div>
  )
}
