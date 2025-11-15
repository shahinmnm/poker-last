import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { menuTree } from '../config/menu'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import SectionHeader from '../components/ui/SectionHeader'

const menuCards = menuTree.filter((item) => item.key !== 'home')

const primaryActions = [
  {
    key: 'create',
    to: '/games/create',
    icon: '🃏',
    glow: true,
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
      <Card className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('common.loading')}
      </Card>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      <Card padding="lg" className="overflow-hidden">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-sm">
            <p className="text-sm uppercase tracking-[0.3em] text-[color:var(--text-muted)]">
              {t('home.hero.badge')}
            </p>
            <h1 className="mt-2 text-xl font-semibold sm:text-2xl">
              {t('home.welcome', { name: user?.first_name || user?.username })}
            </h1>
            <p className="mt-3 text-sm text-[color:var(--text-muted)]">{t('home.tagline')}</p>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {(
                t('home.hero.stats', { returnObjects: true }) as Array<{
                  label: string
                  value: string
                }>
              ).map((metric) => (
                <div key={metric.label} className="flex flex-col">
                  <span className="text-lg font-semibold">{metric.value}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                    {metric.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex w-full flex-col gap-3 sm:max-w-xs">
            {primaryActions.map((action) => (
              <Link key={action.key} to={action.to} className="w-full">
                <Button block size="lg" variant="primary" glow={action.glow}>
                  <span className="mr-2 text-xl">{action.icon}</span>
                  {t(`home.actions.${action.key}.label`)}
                </Button>
                <p className="mt-2 text-xs text-[color:var(--text-muted)]">
                  {t(`home.actions.${action.key}.description`)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title={t('home.primaryMenuTitle')}
          subtitle={t('home.lobbyCallout')}
          action={
            <Link to="/lobby" className="app-button app-button--ghost app-button--md">
              {t('home.actions.viewLobby')}
            </Link>
          }
        />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {menuCards.map((item) => (
            <Link key={item.key} to={item.path} className="app-card app-card--overlay block rounded-3xl p-5 transition hover:-translate-y-1">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                  {t('common.actions.open')}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold">{t(item.labelKey)}</h3>
              {item.descriptionKey && (
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t(item.descriptionKey)}</p>
              )}
              {item.children && (
                <ul className="mt-4 space-y-1 text-sm text-[color:var(--text-muted)]">
                  {item.children.map((child) => (
                    <li key={child.key}>• {t(child.labelKey)}</li>
                  ))}
                </ul>
              )}
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title={t('home.howItWorks.title')} />
        <ol className="mt-4 space-y-3 text-sm text-[color:var(--text-muted)]">
          {howItWorksSteps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-sm font-semibold text-white">
                {index + 1}
              </span>
              <span className="self-center text-[color:var(--text-primary)]">{step}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}
