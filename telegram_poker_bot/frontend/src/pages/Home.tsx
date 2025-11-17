import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'
import HeroHeader from '../components/home/HeroHeader'
import GlassCard from '../components/ui/GlassCard'
import ActionCard from '../components/ui/ActionCard'
import { JoinIcon, PlayIcon, PrivateIcon, TablesIcon, WalletIcon } from '../components/ui/icons'

export default function HomePage() {
  const { ready, initData, user } = useTelegram()
  const { t } = useTranslation()
  const [activeTables, setActiveTables] = useState<any[]>([])
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    if (!initData) return

    apiFetch<{ tables: any[] }>('/users/me/tables', { initData })
      .then((data) => setActiveTables(data.tables || []))
      .catch(() => setActiveTables([]))

    apiFetch<{ balance: number }>('/users/me/balance', { initData })
      .then((data) => setBalance(data.balance))
      .catch(() => setBalance(null))
  }, [initData])

  const hasActiveTables = activeTables.length > 0
  const displayName = useMemo(
    () => user?.first_name || user?.username || 'Player',
    [user],
  )
  const balanceLabel = balance !== null ? `${balance.toLocaleString()} chips` : t('common.loading')
  const activeTableId = hasActiveTables ? activeTables[0].table_id : undefined

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('common.loading')}
      </div>
    )
  }

  const actions = [
    {
      key: 'playPublic',
      icon: PlayIcon,
      to: '/lobby',
      title: t('home.mosaic.playPublic.title'),
      subtitle: t('home.mosaic.playPublic.subtitle'),
      accent: 'primary' as const,
    },
    {
      key: 'createPrivate',
      icon: PrivateIcon,
      to: '/games/create?mode=private',
      title: t('home.mosaic.createPrivate.title'),
      subtitle: t('home.mosaic.createPrivate.subtitle'),
      accent: 'primary' as const,
    },
    {
      key: 'joinWithCode',
      icon: JoinIcon,
      to: '/games/join',
      title: t('home.mosaic.joinWithCode.title'),
      subtitle: t('home.mosaic.joinWithCode.subtitle'),
      accent: 'secondary' as const,
    },
    {
      key: 'myTables',
      icon: TablesIcon,
      to: hasActiveTables ? `/table/${activeTables[0].table_id}` : '/profile/stats',
      title: hasActiveTables ? t('home.actions.resumeGame') : t('home.mosaic.myTables.title'),
      subtitle: hasActiveTables ? t('home.mosaic.liveNow.subtitle', 'Jump back in') : t('home.mosaic.myTables.subtitle'),
      accent: 'secondary' as const,
    },
  ]

  return (
    <div className="space-y-6 pb-6">
      <HeroHeader name={displayName} balanceLabel={balanceLabel} activeTableId={activeTableId} />

      <GlassCard glow className="border-white/8 bg-[rgba(6,12,24,0.9)] px-5 py-5 shadow-[0_20px_52px_rgba(0,0,0,0.78)]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">{t('home.mosaic.heroKicker', 'Premium poker hub')}</span>
            <h2 className="text-2xl font-semibold leading-tight text-[color:var(--color-text)]">{t('home.tagline')}</h2>
            <p className="text-sm text-[color:var(--color-text-muted)]">{t('home.mosaic.hint')}</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[rgba(34,242,239,0.1)] text-[color:var(--color-accent)] shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
            <WalletIcon className="h-6 w-6" />
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <ActionCard
            key={action.key}
            icon={action.icon}
            title={action.title}
            subtitle={action.subtitle}
            to={action.to}
            accent={action.accent}
          />
        ))}
      </div>
    </div>
  )
}
