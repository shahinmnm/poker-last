import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { faDice, faLock, faRightToBracket, faChartLine, faUser, faGear, faFire } from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'
import Card from '../components/ui/Card'
import HomeMenuGrid from '../components/home/HomeMenuGrid'

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
      icon: faDice,
      to: '/lobby',
      quickTag: t('home.mosaic.playPublic.badge', 'HOT'),
      subtitle: t('home.mosaic.playPublic.subtitle'),
      recommended: !hasActiveTables,
      shine: true,
      depth: true,
      tileColor: 'var(--tile-green)',
    },
    {
      key: 'createPrivate',
      icon: faLock,
      to: '/games/create?mode=private',
      quickTag: t('home.mosaic.createPrivate.badge', 'NEW'),
      subtitle: t('home.mosaic.createPrivate.subtitle'),
      recommended: !hasActiveTables,
      badge: hasActiveTables ? undefined : t('home.mosaic.createPrivate.cta', 'Invite-only'),
      tileColor: 'var(--tile-purple)',
    },
    {
      key: 'joinWithCode',
      icon: faRightToBracket,
      to: '/games/join',
      subtitle: t('home.mosaic.joinWithCode.subtitle'),
      pulse: false,
      tileColor: 'var(--tile-blue)',
    },
    {
      key: 'myTables',
      icon: faChartLine,
      to: '/profile/stats',
      badge: activeTables.length > 0 ? activeTables.length : undefined,
      subtitle: t('home.mosaic.myTables.subtitle'),
      recommended: hasActiveTables,
      pulse: hasActiveTables,
      depth: true,
      tileColor: 'var(--tile-orange)',
    },
    {
      key: 'profile',
      icon: faUser,
      to: '/profile',
      subtitle: t('home.mosaic.profile.subtitle'),
      tileColor: 'var(--tile-red)',
    },
    {
      key: 'settings',
      icon: faGear,
      to: '/settings',
      subtitle: t('home.mosaic.settings.subtitle'),
      tileColor: 'var(--tile-yellow)',
    },
    {
      key: 'liveNow',
      icon: faFire,
      to: '/lobby',
      subtitle: t('home.mosaic.liveNow.subtitle', 'Track live tournaments'),
      quickTag: t('home.mosaic.liveNow.badge', 'LIVE'),
      pulse: true,
      badge: hasActiveTables ? t('home.mosaic.liveNow.active', 'Now') : undefined,
      shine: true,
      tileColor: 'var(--tile-green)',
    },
  ]

  const menuItems = mosaicTiles.map((tile) => ({
    ...tile,
    title: t(`home.mosaic.${tile.key}.title`),
    subtitle: tile.subtitle ?? t(`home.mosaic.${tile.key}.subtitle`),
  }))

  return (
    <div className="space-y-[var(--space-xl)] pt-[var(--space-sm)]">
      <div className="glass-panel relative mx-auto w-full px-5 py-5 text-center shadow-[0_18px_48px_rgba(0,0,0,0.5)]" style={{ borderRadius: 'var(--radius-xl)' }}>
        <div className="mx-auto inline-flex items-center justify-center rounded-full border border-[color:var(--color-accent-soft)] bg-[color:var(--color-accent-soft)]/50 px-3 py-1 font-semibold uppercase tracking-[0.16em] text-[color:var(--color-accent-start)]" style={{ fontSize: 'var(--fs-caption)' }}>
          {t('home.mosaic.heroKicker', 'Premium poker hub')}
        </div>
        <div className="mt-2 space-y-2">
          <p className="font-bold text-[color:var(--color-text)]" style={{ fontSize: 'var(--fs-large)' }}>{t('home.tagline')}</p>
          <div className="mx-auto h-px w-16 bg-white/15" />
          <p className="leading-relaxed text-[color:var(--color-text-muted)] line-clamp-2" style={{ fontSize: 'var(--fs-label)' }}>
            {t('home.mosaic.hint')}
          </p>
        </div>
      </div>

      <HomeMenuGrid items={menuItems} />

      <div className="glass-panel px-5 py-4 text-center" style={{ borderRadius: 'var(--radius-xl)' }}>
        <p className="leading-relaxed text-[color:var(--color-text-muted)]" style={{ fontSize: 'var(--fs-label)' }}>
          {hasActiveTables ? t('home.mosaic.activeTablesHint') : t('home.mosaic.hint')}
        </p>
      </div>
    </div>
  )
}
