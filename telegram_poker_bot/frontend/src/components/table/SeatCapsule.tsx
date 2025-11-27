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

    const interactive = Boolean(onSit) && !disabled
    const avatarSize = callToAction ? AVATAR_SIZE.cta : AVATAR_SIZE.base

    const textMuted = hasFolded ? 'text-white/50' : 'text-white'
    const opacityState = hasFolded ? 'opacity-60' : 'opacity-100'

    const ringAccent = isActive
      ? 'shadow-[0_0_0_3px_rgba(52,211,153,0.9)] animate-[pulse_1.2s_ease-in-out_infinite]'
      : isHero
        ? 'shadow-[0_0_0_2px_rgba(56,189,248,0.75)]'
        : 'shadow-[0_0_0_1.5px_rgba(255,255,255,0.25)]'

    const avatarTone = useMemo(() => {
      if (callToAction) return 'border-emerald-300/80 bg-emerald-500/10 text-emerald-50'
      if (isEmpty) return 'border-dashed border-white/50 bg-white/10 text-white'
      if (isHero) return 'border-cyan-200/80 bg-gradient-to-br from-cyan-400/20 to-emerald-400/10'
      return 'border-white/60 bg-gradient-to-br from-white/20 to-white/5'
    }, [callToAction, isEmpty, isHero])

    const labelTone = useMemo(() => {
      if (callToAction) return 'bg-emerald-500/90 text-emerald-950 border-emerald-200'
      if (isHero) return 'bg-cyan-500/90 text-emerald-950 border-cyan-200/80'
      return 'bg-black/40 text-white border-white/20'
    }, [callToAction, isHero])

    return (
      <div
        ref={ref}
        className={`relative flex min-w-[108px] max-w-[26vw] flex-col items-center gap-2 text-white drop-shadow-[0_10px_26px_rgba(0,0,0,0.55)] transition-transform duration-300 ${
          interactive ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'
        } ${opacityState}`}
        onClick={interactive ? onSit : undefined}
        style={{ width: callToAction ? 'min(56vw, 210px)' : 'min(26vw, 168px)' }}
      >
        <div
          className={`relative flex items-center justify-center rounded-full border-2 ${avatarTone} ${ringAccent}`}
          style={{ height: `${avatarSize + 14}px`, width: `${avatarSize + 14}px` }}
        >
          {isEmpty ? (
            <FontAwesomeIcon icon={faPlus} className="text-lg" />
          ) : (
            <span className="text-base font-bold drop-shadow-sm">{initials}</span>
          )}
          {showFoldedLabel && (
            <div className="absolute -bottom-1.5 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-white shadow">
              {t('table.folded', { defaultValue: 'FOLD' })}
            </div>
          )}
          {isSittingOut && !hasFolded && (
            <div className="absolute -bottom-1.5 rounded-full bg-white/25 px-2 py-0.5 text-[9px] font-semibold uppercase text-white/90 shadow">
              {t('table.sittingOut', { defaultValue: 'Sit out' })}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          {callToAction ? (
            <span
              className={`rounded-full border px-3 py-1 text-[12px] font-bold uppercase tracking-wide shadow-lg ${labelTone}`}
            >
              {t('table.actions.takeSeat', { defaultValue: 'Take your seat' })}
            </span>
          ) : isEmpty ? (
            <span className="rounded-full border border-white/30 bg-black/40 px-3 py-1 text-[12px] font-semibold text-white/90 backdrop-blur">
              {t('table.seat.tapToSit', { defaultValue: 'Tap to sit' })}
            </span>
          ) : (
            <>
              <div className={`flex items-center gap-1 text-[11px] font-semibold leading-tight ${textMuted}`}>
                <span className={`truncate max-w-[120px] rounded-full border px-3 py-1 ${labelTone}`}>
                  {name}
                </span>
                {showYouBadge && (
                  <span className="rounded-full bg-sky-500/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-black">
                    {t('table.players.youTag', { defaultValue: 'You' })}
                  </span>
                )}
              </div>
              <div className={`text-[11px] font-semibold text-emerald-100 ${hasFolded ? 'opacity-60' : ''}`}>
                {t('table.fields.stack', { defaultValue: 'Stack' })}: {stack?.toLocaleString?.() ?? stack}
              </div>
            </>
          )}

          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
            <span className="rounded-full bg-white/10 px-2 py-0.5">{seatLabel}</span>
            {positionLabel && !callToAction && (
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-white/90 border border-emerald-200/40">
                {positionLabel}
              </span>
            )}
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
