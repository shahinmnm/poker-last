import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import Avatar from '../ui/Avatar'
import GlassCard from '../ui/GlassCard'
import PrimaryButton from '../ui/PrimaryButton'
import { SettingsIcon, TablesIcon, WalletIcon } from '../ui/icons'

interface HeroHeaderProps {
  name: string
  balanceLabel: string
  activeTableId?: string
}

export function HeroHeader({ name, balanceLabel, activeTableId }: HeroHeaderProps) {
  const { t } = useTranslation()
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-white/5 bg-[linear-gradient(180deg,#071324_0%,#030914_100%)] p-5 shadow-[0_24px_62px_rgba(0,0,0,0.85)]">
      <span className="pointer-events-none absolute inset-x-[-30%] bottom-[-22%] h-64 bg-[radial-gradient(circle_at_center,rgba(34,242,239,0.2),transparent_60%)] blur-3xl" aria-hidden />
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-semibold text-[color:var(--color-accent)] shadow-[0_10px_28px_rgba(0,0,0,0.55)]">
            ♠
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-text-muted)]">{t('home.tagline', 'Premium Poker')}</span>
            <span className="text-lg font-semibold text-[color:var(--color-text)]">Nebula Poker Hub</span>
          </div>
        </div>
        <Link
          to="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[color:var(--color-text)] shadow-[0_12px_28px_rgba(0,0,0,0.55)] transition active:scale-95"
          aria-label={t('menu.settings.label')}
        >
          <SettingsIcon className="h-6 w-6" />
        </Link>
      </div>

      <div className="relative mt-6 flex flex-col gap-4">
        <GlassCard glow className="border-white/8 bg-[rgba(6,12,24,0.92)] px-5 py-4 shadow-[0_18px_46px_rgba(0,0,0,0.75)]">
          <div className="flex items-center gap-3">
            <Avatar size="lg" className="h-12 w-12 border border-white/15" />
            <div className="flex flex-1 flex-col">
              <span className="text-base font-semibold text-[color:var(--color-text)]">{name}</span>
              <span className="text-sm text-[color:var(--color-text-muted)]">{balanceLabel}</span>
            </div>
            <div className="flex items-center gap-2 text-[color:var(--color-accent)]">
              <WalletIcon className="h-6 w-6" />
            </div>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-3 rounded-[18px] border border-white/5 bg-[rgba(255,255,255,0.04)]/30 px-5 py-4 shadow-[0_14px_36px_rgba(0,0,0,0.65)] backdrop-blur-[18px]">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--color-text-muted)]">{t('home.mosaic.heroKicker', 'Premium poker hub')}</span>
              <span className="text-lg font-semibold text-[color:var(--color-text)]">{activeTableId ? t('home.actions.resumeGame') : t('home.actions.quickPlay')}</span>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/10 bg-[rgba(34,242,239,0.1)] text-[color:var(--color-accent)] shadow-[0_12px_30px_rgba(0,0,0,0.55)]">
              <TablesIcon className="h-5 w-5" />
            </div>
          </div>
          <PrimaryButton block>{activeTableId ? t('home.actions.resumeGame') : t('home.actions.quickStart')}</PrimaryButton>
          <div className="flex items-center justify-between text-[12px] text-[color:var(--color-text-muted)]">
            <span>{activeTableId ? t('home.mosaic.liveNow.subtitle', 'Jump back to your table') : t('home.mosaic.hint')}</span>
            {activeTableId && (
              <Link to={`/table/${activeTableId}`} className="text-[color:var(--color-accent)]">
                {t('home.mosaic.liveNow.active', 'Open')}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroHeader
