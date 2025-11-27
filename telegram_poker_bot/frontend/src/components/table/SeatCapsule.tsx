import { forwardRef, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins, faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'

interface SeatCapsuleProps {
  name?: string | null
  stack?: number
  seatLabel: string
  positionLabel?: string
  isHero?: boolean
  isActive?: boolean
  hasFolded?: boolean
  isEmpty?: boolean
  callToAction?: boolean
  onSit?: () => void
  disabled?: boolean
  showFoldedLabel?: boolean
  showYouBadge?: boolean
  isSittingOut?: boolean
  isAllIn?: boolean
}

const AVATAR_SIZE = { base: 44, cta: 48 }

const SeatCapsule = forwardRef<HTMLDivElement, SeatCapsuleProps>(
  (
    {
      name,
      stack = 0,
      seatLabel,
      positionLabel,
      isHero = false,
      isActive = false,
      hasFolded = false,
      isEmpty = false,
      callToAction = false,
      onSit,
      disabled = false,
      showFoldedLabel = false,
      showYouBadge = false,
      isSittingOut = false,
      isAllIn = false,
    },
    ref,
  ) => {
    const { t } = useTranslation()

    const initials = useMemo(() => {
      if (!name) return '?'
      const cleaned = name.trim()
      if (!cleaned) return '?'
      return cleaned
        .split(' ')
        .filter((piece) => piece.length > 0)
        .map((piece) => piece[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    }, [name])

    const interactive = Boolean(onSit) && !disabled && (callToAction || isEmpty)
    const avatarSize = callToAction ? AVATAR_SIZE.cta : AVATAR_SIZE.base

    const textMuted = hasFolded ? 'text-white/60' : 'text-white'
    const opacityState = hasFolded ? 'opacity-70' : 'opacity-100'

    const ringAccent = isActive
      ? 'shadow-[0_0_0_3px_rgba(52,211,153,0.9)] animate-[pulse_1.2s_ease-in-out_infinite]'
      : isHero
        ? 'shadow-[0_0_0_2.5px_rgba(34,211,238,0.85)] ring-2 ring-cyan-300/50 shadow-cyan-400/40'
        : 'shadow-[0_0_0_1.5px_rgba(255,255,255,0.22)]'

    const avatarTone = useMemo(() => {
      if (callToAction) return 'border-emerald-200/80 bg-emerald-300/10 text-emerald-50'
      if (isEmpty) return 'border-white/60 bg-white/5 text-white'
      if (isHero) return 'border-cyan-200/80 bg-gradient-to-br from-cyan-300/15 via-white/5 to-emerald-300/10'
      return 'border-white/50 bg-gradient-to-br from-white/10 to-white/0'
    }, [callToAction, isEmpty, isHero])

    return (
      <div
        ref={ref}
        className={`relative flex min-w-[108px] flex-col items-center gap-2 text-white drop-shadow-[0_10px_26px_rgba(0,0,0,0.35)] transition-transform duration-300 ${
          interactive ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'
        } ${opacityState}`}
        onClick={interactive ? onSit : undefined}
        style={{ width: callToAction ? 'min(52vw, 196px)' : 'min(32vw, 176px)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`relative flex items-center justify-center rounded-full border-2 ${avatarTone} ${ringAccent}`}
            style={{ height: `${avatarSize + 6}px`, width: `${avatarSize + 6}px` }}
          >
            {isEmpty ? (
              <FontAwesomeIcon icon={faPlus} className="text-base opacity-80" />
            ) : (
              <span className="text-sm font-bold drop-shadow-sm">{initials}</span>
            )}
          </div>

          <div className="flex flex-col items-start gap-1 text-left">
            <div className="flex items-center gap-2">
              {positionLabel && !callToAction && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-50">
                  {positionLabel}
                </span>
              )}
              {isAllIn && !isEmpty && !callToAction && (
                <span className="rounded-full border border-rose-200/60 bg-rose-200/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-50">
                  {t('table.actions.allIn', { defaultValue: 'All-in' })}
                </span>
              )}
              {showFoldedLabel && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                  {t('table.folded', { defaultValue: 'Folded' })}
                </span>
              )}
              {isSittingOut && !hasFolded && (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
                  {t('table.sittingOut', { defaultValue: 'Sit out' })}
                </span>
              )}
            </div>

            {callToAction || isEmpty ? (
              <button
                type="button"
                disabled={disabled || !interactive}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] shadow-sm transition-all ${
                  disabled
                    ? 'border-white/15 bg-white/5 text-white/60'
                    : 'border-emerald-200/60 bg-emerald-300/10 text-emerald-50 hover:border-emerald-200 hover:bg-emerald-300/20'
                }`}
              >
                {t('table.actions.takeSeat', { defaultValue: 'Take seat' })}
              </button>
            ) : (
              <>
                <div className={`flex items-center gap-2 text-[12px] font-semibold leading-tight ${textMuted}`}>
                  <span className="max-w-[152px] truncate leading-snug">{name}</span>
                  {showYouBadge && (
                    <span className="rounded-full bg-sky-300/90 px-1.5 py-0.5 text-[9px] font-black uppercase text-black shadow-sm">
                      {t('table.players.youTag', { defaultValue: 'You' })}
                    </span>
                  )}
                </div>
                <div className={`flex items-center gap-1 text-[11px] font-semibold text-emerald-100 ${hasFolded ? 'opacity-60' : ''}`}>
                  <FontAwesomeIcon icon={faCoins} className="text-[12px] text-amber-200" />
                  <span className="tabular-nums tracking-tight">{stack?.toLocaleString?.() ?? stack}</span>
                </div>
              </>
            )}

            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {seatLabel}
            </div>
          </div>
        </div>
      </div>
    )
  },
)

SeatCapsule.displayName = 'SeatCapsule'

export default SeatCapsule
