import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'
import Card from '../components/ui/Card'
import HomeMosaicTile from '../components/ui/HomeMosaicTile'

export default function HomePage() {
  const { ready, initData } = useTelegram()
  const { t } = useTranslation()
  const [activeTables, setActiveTables] = useState<any[]>([])

  useEffect(() => {
    if (!initData) return

    // Fetch active tables to show contextual recommendations
    apiFetch<{ tables: any[] }>('/users/me/tables', { initData })
      .then((data) => setActiveTables(data.tables || []))
      .catch(() => setActiveTables([]))
  }, [initData])

  const hasActiveTables = activeTables.length > 0

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
      badge: undefined,
      highlighted: !hasActiveTables, // Highlight if user has no active tables
    },
    {
      key: 'createPrivate',
      icon: '🃏',
      to: '/games/create?mode=private',
      badge: undefined,
      highlighted: !hasActiveTables, // Highlight if user has no active tables
    },
    {
      key: 'joinWithCode',
      icon: '➕',
      to: '/games/join',
      badge: undefined,
      highlighted: false,
    },
    {
      key: 'myTables',
      icon: '📊',
      to: '/profile/stats',
      badge: activeTables.length > 0 ? activeTables.length : undefined,
      highlighted: hasActiveTables, // Highlight if user has active tables
    },
    {
      key: 'profile',
      icon: '👤',
      to: '/profile',
      badge: undefined,
      highlighted: false,
    },
    {
      key: 'settings',
      icon: '⚙️',
      to: '/settings',
      badge: undefined,
      highlighted: false,
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
            highlighted={tile.highlighted}
          />
        ))}
      </div>

      {/* Contextual hint */}
      <Card padding="md">
        <p className="text-center text-xs text-[color:var(--text-muted)]">
          {hasActiveTables 
            ? t('home.mosaic.activeTablesHint') 
            : t('home.mosaic.hint')}
        </p>
      </Card>
    </div>
  )
}
