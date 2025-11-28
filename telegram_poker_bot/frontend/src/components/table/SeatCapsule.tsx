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
  detailsPlacement?: 'inside' | 'outside'
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
      detailsPlacement = 'inside',
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
    const showDetailsInside = detailsPlacement === 'inside'

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
        className={`relative flex min-w-[100px] max-w-[26vw] flex-col items-center gap-1 text-white transition-transform duration-300 ${
          interactive ? 'cursor-pointer hover:-translate-y-1' : 'cursor-default'
        } ${opacityState}`}
        onClick={interactive ? onSit : undefined}
        style={{ width: callToAction ? 'min(52vw, 200px)' : 'min(26vw, 164px)' }}
      >
        <div className="flex flex-col items-center gap-1.5" style={{ width: '100%' }}>
          <div
            className={`relative flex items-center justify-center rounded-full border-2 ${avatarTone} ${ringAccent}`}
            style={{ height: `${avatarSize + 10}px`, width: `${avatarSize + 10}px` }}
          >
            {isEmpty ? (
              <FontAwesomeIcon icon={faPlus} className="text-base opacity-80" />
            ) : (
              <span className="text-sm font-bold drop-shadow-sm">{initials}</span>
            )}
            {showFoldedLabel && (
              <div className="absolute -bottom-2 rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase text-white shadow">
                {t('table.folded', { defaultValue: 'FOLD' })}
              </div>
            )}
            {isSittingOut && !hasFolded && (
              <div className="absolute -bottom-2 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold uppercase text-white/90 shadow">
                {t('table.sittingOut', { defaultValue: 'Sit out' })}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-0.5 text-center">
            {(callToAction || isEmpty) && (
              <button
                type="button"
                disabled={disabled || !interactive}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide shadow-lg transition-all ${
                  disabled
                    ? 'bg-white/10 text-white/60'
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-300 text-emerald-950 hover:brightness-110'
                }`}
              >
                {t('table.actions.takeSeat', { defaultValue: 'Sit at Table' })}
              </button>
            )}

            {showDetailsInside && (
              <>
                {!callToAction && !isEmpty && (
                  <>
                    <div className={`flex items-center gap-1 text-[11px] font-semibold leading-tight ${textMuted}`}>
                      <span className="max-w-[132px] truncate leading-snug">{name}</span>
                      {showYouBadge && (
                        <span className="rounded-full bg-sky-400/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-black shadow-sm">
                          {t('table.players.youTag', { defaultValue: 'You' })}
                        </span>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 text-[10px] font-semibold text-emerald-100 ${hasFolded ? 'opacity-60' : ''}`}>
                      <FontAwesomeIcon icon={faCoins} className="text-[11px] text-amber-200" />
                      <span className="tabular-nums tracking-tight">{stack?.toLocaleString?.() ?? stack}</span>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  <span>{seatLabel}</span>
                  {positionLabel && !callToAction && (
                    <span className="text-emerald-100 drop-shadow">{positionLabel}</span>
                  )}
                  {isAllIn && !isEmpty && !callToAction && (
                    <span className="text-rose-200 drop-shadow-sm">
                      {t('table.actions.allIn', { defaultValue: 'All-in' })}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  },
)

SeatCapsule.displayName = 'SeatCapsule'

export default SeatCapsule
