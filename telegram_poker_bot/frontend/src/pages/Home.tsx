import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { menuTree } from '../config/menu'

const menuCards = menuTree.filter((item) => item.key !== 'home')

const quickActions = [
  {
    key: 'anonymous',
    to: '/lobby',
    color: 'bg-blue-500 hover:bg-blue-600',
    icon: '⚡️',
  },
  {
    key: 'group',
    to: '/games/create',
    color: 'bg-emerald-500 hover:bg-emerald-600',
    icon: '👥',
  },
]

export default function HomePage() {
  const { ready, user } = useTelegram()
  const { t } = useTranslation()
  const howItWorksSteps = t('home.howItWorks.steps', {
    returnObjects: true,
  }) as string[]

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h1 className="text-xl font-semibold sm:text-2xl">
          {t('home.welcome', { name: user?.first_name })}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('home.tagline')}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {quickActions.map((action) => (
            <Link
              key={action.key}
              to={action.to}
              className={`${action.color} flex items-center justify-between rounded-xl px-4 py-4 text-white transition`}
            >
              <div>
                <h2 className="text-lg font-semibold">
                  {t(`home.quickActions.${action.key}.title`)}
                </h2>
                <p className="mt-1 text-sm text-white/80">
                  {t(`home.quickActions.${action.key}.description`)}
                </p>
              </div>
              <span className="text-3xl">{action.icon}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('home.primaryMenuTitle')}</h2>
          <Link to="/lobby" className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {t('home.lobbyCallout')}
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {menuCards.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              className="rounded-2xl bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                  {t('common.actions.open')}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{t(item.labelKey)}</h3>
              {item.descriptionKey && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  {t(item.descriptionKey)}
                </p>
              )}
              {item.children && (
                <ul className="mt-4 space-y-1 text-sm text-gray-500 dark:text-gray-400">
                  {item.children.map((child) => (
                    <li key={child.key}>• {t(child.labelKey)}</li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
        <h2 className="text-lg font-semibold">{t('home.howItWorks.title')}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600 dark:text-gray-300">
          {howItWorksSteps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  )
}
