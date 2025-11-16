import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'
import Card from '../components/ui/Card'
import HomeMenuGrid from '../components/home/HomeMenuGrid'
import {
  JoinIcon,
  LiveIcon,
  PlayIcon,
  PrivateIcon,
  ProfileIcon,
  SettingsIcon,
  TablesIcon,
} from '../components/ui/icons'

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

  const mosaicTiles = [
    {
      key: 'playPublic',
      icon: PlayIcon,
      to: '/lobby',
      quickTag: t('home.mosaic.playPublic.badge', 'HOT'),
      subtitle: t('home.mosaic.playPublic.subtitle'),
      recommended: !hasActiveTables,
      shine: true,
      depth: true,
    },
    {
      key: 'createPrivate',
      icon: PrivateIcon,
      to: '/games/create?mode=private',
      quickTag: t('home.mosaic.createPrivate.badge', 'NEW'),
      subtitle: t('home.mosaic.createPrivate.subtitle'),
      recommended: !hasActiveTables,
      badge: hasActiveTables ? undefined : t('home.mosaic.createPrivate.cta', 'Invite-only'),
    },
    {
      key: 'joinWithCode',
      icon: JoinIcon,
      to: '/games/join',
      subtitle: t('home.mosaic.joinWithCode.subtitle'),
      pulse: false,
    },
    {
      key: 'myTables',
      icon: TablesIcon,
      to: '/profile/stats',
      badge: activeTables.length > 0 ? activeTables.length : undefined,
      subtitle: t('home.mosaic.myTables.subtitle'),
      recommended: hasActiveTables,
      pulse: hasActiveTables,
      depth: true,
    },
    {
      key: 'profile',
      icon: ProfileIcon,
      to: '/profile',
      subtitle: t('home.mosaic.profile.subtitle'),
    },
    {
      key: 'settings',
      icon: SettingsIcon,
      to: '/settings',
      subtitle: t('home.mosaic.settings.subtitle'),
    },
    {
      key: 'liveNow',
      icon: LiveIcon,
      to: '/lobby',
      subtitle: t('home.mosaic.liveNow.subtitle', 'Track live tournaments'),
      quickTag: t('home.mosaic.liveNow.badge', 'LIVE'),
      pulse: true,
      badge: hasActiveTables ? t('home.mosaic.liveNow.active', 'Now') : undefined,
      shine: true,
    },
  ]

  const menuItems = mosaicTiles.map((tile) => ({
    ...tile,
    title: t(`home.mosaic.${tile.key}.title`),
    subtitle: tile.subtitle ?? t(`home.mosaic.${tile.key}.subtitle`),
  }))

  return (
    <div className="space-y-6 pt-2">
      <Card padding="md" className="app-card--overlay text-center">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--accent-end)]">
            {t('home.mosaic.heroKicker', 'Premium poker hub')}
          </p>
          <p className="text-sm font-medium text-[color:var(--text-primary)]">
            {t('home.tagline')}
          </p>
          <p className="text-xs text-[color:var(--text-muted)] line-clamp-2">
            {t('home.mosaic.hint')}
          </p>
        </div>
      </Card>

      <HomeMenuGrid items={menuItems} />

      <Card padding="md" className="app-card--overlay text-center">
        <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
          {hasActiveTables ? t('home.mosaic.activeTablesHint') : t('home.mosaic.hint')}
        </p>
      </Card>
    </div>
  )
}
