import { forwardRef, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
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

const AVATAR_SIZE = { base: 32, cta: 34 }

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

    const interactive = Boolean(onSit) && !disabled
    const avatarSize = callToAction ? AVATAR_SIZE.cta : AVATAR_SIZE.base

    const capsuleTone = useMemo(() => {
      if (isEmpty) return 'bg-white/10 border-white/30'
      return isHero ? 'bg-white/12 border-sky-300/35' : 'bg-white/10 border-white/25'
    }, [isEmpty, isHero])

    const textMuted = hasFolded ? 'text-white/50' : 'text-white'
    const opacityState = hasFolded ? 'opacity-60' : 'opacity-100'

    const ringAccent = isActive
      ? 'shadow-[0_0_0_2px_rgba(52,211,153,0.9)] animate-[pulse_1.2s_ease-in-out_infinite]'
      : isHero
        ? 'shadow-[0_0_0_1.5px_rgba(56,189,248,0.8)]'
        : ''

    return (
      <div
        ref={ref}
        className={`relative flex min-h-[86px] min-w-[128px] max-w-[22vw] flex-col items-center gap-1 rounded-2xl px-3 py-2 ${capsuleTone} backdrop-blur-2xl border shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all duration-300 ${
          interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(0,0,0,0.4)]' : 'cursor-default'
        } ${opacityState}`}
        onClick={interactive ? onSit : undefined}
        style={{ width: callToAction ? 'min(54vw, 190px)' : 'min(22vw, 172px)' }}
      >
        <div
          className={`relative flex items-center justify-center rounded-full border ${
            isEmpty ? 'border-white/35 text-white' : 'border-white/25 text-white'
          } ${ringAccent}`}
          style={{ height: `${avatarSize}px`, width: `${avatarSize}px` }}
        >
          {isEmpty ? <FontAwesomeIcon icon={faPlus} className="text-lg" /> : <span className="text-sm font-bold">{initials}</span>}
          {showFoldedLabel && (
            <div className="absolute -bottom-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-white">
              {t('table.folded', { defaultValue: 'FOLD' })}
            </div>
          )}
          {isSittingOut && !hasFolded && (
            <div className="absolute -bottom-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-white/80">
              {t('table.sittingOut', { defaultValue: 'Sit out' })}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          {callToAction ? (
            <span className="text-[12px] font-semibold text-white drop-shadow-sm">
              {t('table.actions.takeSeat', { defaultValue: 'Take your seat' })}
            </span>
          ) : isEmpty ? (
            <span className="text-[12px] font-semibold text-white/90">
              {t('table.seat.tapToSit', { defaultValue: 'Tap to sit' })}
            </span>
          ) : (
            <>
              <div className={`flex items-center gap-1 text-[11px] font-semibold leading-tight ${textMuted}`}>
                <span className="truncate max-w-[110px]">{name}</span>
                {showYouBadge && (
                  <span className="rounded-full bg-sky-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">
                    {t('table.players.youTag', { defaultValue: 'You' })}
                  </span>
                )}
              </div>
              <div className={`text-[10px] font-semibold text-emerald-100 ${hasFolded ? 'opacity-60' : ''}`}>
                {t('table.fields.stack', { defaultValue: 'Stack' })}: {stack?.toLocaleString?.() ?? stack}
              </div>
            </>
          )}

          <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-white/60">
            <span>{seatLabel}</span>
            {positionLabel && !callToAction && <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/80">{positionLabel}</span>}
            {isAllIn && !isEmpty && !callToAction && (
              <span className="rounded-full bg-rose-500/80 px-2 py-0.5 text-[9px] text-black">
                {t('table.actions.allIn', { defaultValue: 'All-in' })}
              </span>
            )}
          </div>
        </div>
      </div>
    )
  },
)

SeatCapsule.displayName = 'SeatCapsule'

export default SeatCapsule
