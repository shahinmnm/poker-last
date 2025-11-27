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

    const textMuted = hasFolded ? 'text-white/50' : 'text-white'
    const opacityState = hasFolded ? 'opacity-60' : 'opacity-100'

    const ringAccent = isActive
      ? 'shadow-[0_0_0_3px_rgba(52,211,153,0.9)] animate-[pulse_1.2s_ease-in-out_infinite]'
      : isHero
        ? 'shadow-[0_0_0_2.5px_rgba(34,211,238,0.85)] ring-2 ring-cyan-300/50 shadow-cyan-400/50'
        : 'shadow-[0_0_0_1.5px_rgba(255,255,255,0.25)]'

    const avatarTone = useMemo(() => {
      if (callToAction) return 'border-emerald-200/90 bg-emerald-400/10 text-emerald-50'
      if (isEmpty) return 'border-white/60 bg-white/10 text-white'
      if (isHero) return 'border-cyan-200/80 bg-gradient-to-br from-cyan-300/15 via-white/5 to-emerald-300/15'
      return 'border-white/60 bg-gradient-to-br from-white/15 to-white/5'
    }, [callToAction, isEmpty, isHero])

    return (
      <div
        ref={ref}
        className={`relative flex max-w-[26vw] flex-col items-center gap-1 text-white drop-shadow-[0_10px_22px_rgba(0,0,0,0.4)] transition-transform duration-200 ${
          interactive ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'
        } ${opacityState}`}
        onClick={interactive ? onSit : undefined}
        style={{ width: callToAction ? 'min(52vw, 196px)' : 'min(26vw, 164px)' }}
      >
        <div
          className={`flex w-full items-center gap-2 rounded-xl bg-black/25 px-3 py-2 backdrop-blur-sm ${
            isHero ? 'ring-1 ring-cyan-200/30' : 'ring-1 ring-white/10'
          }`}
        >
          <div
            className={`relative flex items-center justify-center rounded-full border-2 ${avatarTone} ${ringAccent}`}
            style={{ height: `${avatarSize + 4}px`, width: `${avatarSize + 4}px` }}
          >
            {isEmpty ? (
              <FontAwesomeIcon icon={faPlus} className="text-base opacity-80" />
            ) : (
              <span className="text-sm font-bold drop-shadow-sm">{initials}</span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-0.5 text-left">
            {callToAction || isEmpty ? (
              <button
                type="button"
                disabled={disabled || !interactive}
                className={`flex items-center justify-between rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide shadow-lg transition-all ${
                  disabled
                    ? 'bg-white/10 text-white/60'
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-300 text-emerald-950 hover:brightness-110'
                }`}
              >
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon icon={faPlus} className="text-xs" />
                  {t('table.actions.takeSeat', { defaultValue: 'Sit' })}
                </span>
              </button>
            ) : (
              <>
                <div className={`flex items-center gap-1 text-[12px] font-semibold leading-tight ${textMuted}`}>
                  <span className="max-w-[132px] truncate leading-snug">{name}</span>
                  {showYouBadge && (
                    <span className="rounded-full bg-sky-400/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-black shadow-sm">
                      {t('table.players.youTag', { defaultValue: 'You' })}
                    </span>
                  )}
                </div>
                <div className={`flex flex-wrap items-center gap-1 text-[11px] font-semibold text-emerald-100 ${hasFolded ? 'opacity-60' : ''}`}>
                  <FontAwesomeIcon icon={faCoins} className="text-[12px] text-amber-200" />
                  <span className="tabular-nums tracking-tight">{stack?.toLocaleString?.() ?? stack}</span>
                  {isSittingOut && !hasFolded && (
                    <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] uppercase text-white/90">
                      {t('table.sittingOut', { defaultValue: 'Sit out' })}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">
          <span className="rounded-full bg-white/10 px-2 py-0.5">{seatLabel}</span>
          {positionLabel && !callToAction && (
            <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-emerald-50 drop-shadow">{positionLabel}</span>
          )}
          {isAllIn && !isEmpty && !callToAction && (
            <span className="rounded-full bg-rose-500/30 px-2 py-0.5 text-rose-50 drop-shadow-sm">
              {t('table.actions.allIn', { defaultValue: 'All-in' })}
            </span>
          )}
          {showFoldedLabel && !callToAction && (
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-white">
              {t('table.folded', { defaultValue: 'Fold' })}
            </span>
          )}
        </div>
      </div>
    )
  },
)

SeatCapsule.displayName = 'SeatCapsule'

export default SeatCapsule
