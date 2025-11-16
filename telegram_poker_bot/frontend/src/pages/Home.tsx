import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import Card from '../components/ui/Card'
import HomeMosaicTile from '../components/ui/HomeMosaicTile'

export default function HomePage() {
  const { ready, user } = useTelegram()
  const { t } = useTranslation()

  const displayName = user?.first_name || user?.username
  const welcomeMessage = displayName
    ? t('home.welcomeWithName', { name: displayName })
    : t('home.welcome')

  if (!ready) {
    return (
      <Card className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('common.loading')}
      </Card>
    )
  }

  // Mosaic tiles configuration
  const mosaicTiles = [
    {
      key: 'playPublic',
      icon: '🎲',
      to: '/lobby',
      badge: undefined, // Could be dynamic: active public table count
    },
    {
      key: 'createPrivate',
      icon: '🃏',
      to: '/games/create',
      badge: undefined,
    },
    {
      key: 'joinWithCode',
      icon: '➕',
      to: '/games/join',
      badge: undefined,
    },
    {
      key: 'myTables',
      icon: '📊',
      to: '/profile/stats',
      badge: undefined, // Could be dynamic: active tables count
    },
    {
      key: 'profile',
      icon: '👤',
      to: '/profile',
      badge: undefined,
    },
    {
      key: 'settings',
      icon: '⚙️',
      to: '/settings',
      badge: undefined,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting Section */}
      <Card padding="lg">
        <div className="space-y-4">
          {/* Welcome message */}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--text-muted)]">
              {t('home.hero.badge')}
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{welcomeMessage}</h1>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">{t('home.tagline')}</p>
          </div>

          {/* Compact stats row */}
          <div className="grid grid-cols-3 gap-4 pt-2">
            {(
              t('home.hero.stats', { returnObjects: true }) as Array<{
                label: string
                value: string
              }>
            ).map((metric) => (
              <div key={metric.label} className="flex flex-col">
                <span className="text-lg font-semibold text-[color:var(--accent-end)]">
                  {metric.value}
                </span>
                <span className="text-[10px] uppercase tracking-[0.15em] text-[color:var(--text-muted)]">
                  {metric.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Mosaic Tiles Section */}
      <div className="grid grid-cols-2 gap-4">
        {mosaicTiles.map((tile) => (
          <HomeMosaicTile
            key={tile.key}
            icon={tile.icon}
            title={t(`home.mosaic.${tile.key}.title`)}
            subtitle={t(`home.mosaic.${tile.key}.subtitle`)}
            badge={tile.badge}
            to={tile.to}
          />
        ))}
      </div>

      {/* Contextual hint */}
      <Card padding="md">
        <p className="text-center text-xs text-[color:var(--text-muted)]">
          {t('home.mosaic.hint')}
        </p>
      </Card>
    </div>
  )
}
