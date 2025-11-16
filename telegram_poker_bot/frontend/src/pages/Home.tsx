import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import Card from '../components/ui/Card'
import HomeMosaicTile from '../components/ui/HomeMosaicTile'

export default function HomePage() {
  const { ready } = useTelegram()
  const { t } = useTranslation()

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
      to: '/games/create?mode=private',
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
      {/* Welcome Section - Simplified */}
      <Card padding="md">
        <p className="text-sm text-[color:var(--text-muted)] text-center">
          {t('home.tagline')}
        </p>
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
