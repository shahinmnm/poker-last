import { forwardRef, useMemo } from 'react'
import clsx from 'clsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'

import { formatChips } from '@/utils/formatChips'

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

type PositionType = 'BTN' | 'SB' | 'BB'

function PositionBadge({ position }: { position?: PositionType }) {
  if (!position) return null

  const badgeClasses = clsx(
    'seat-capsule-position-badge',
    'absolute -right-1 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full text-[9px] font-semibold uppercase tracking-[0.2em] shadow-sm',
    {
      'bg-amber-300 text-amber-900': position === 'BTN',
      'bg-sky-400 text-sky-950': position === 'SB',
      'bg-purple-400 text-purple-950': position === 'BB',
    },
  )

  return <span className={badgeClasses}>{position}</span>
}

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

    const safeName = name || seatLabel
    const safeStack = Number.isFinite(stack) ? stack : 0
    const normalizedPosition = (positionLabel ?? '').toUpperCase()
    const activePosition = (['BTN', 'SB', 'BB'] as PositionType[]).includes(normalizedPosition as PositionType)
      ? (normalizedPosition as PositionType)
      : undefined

    return (
      <div
        ref={ref}
        className={clsx(
          'seat-capsule relative flex min-w-[100px] max-w-[26vw] flex-col items-center gap-1 text-slate-50 transition-transform duration-300',
          {
            'cursor-pointer hover:-translate-y-1': interactive,
            'cursor-default': !interactive,
          },
          opacityState,
          isHero && 'seat-capsule--hero',
          isActive && 'seat-capsule--active',
        )}
        onClick={interactive ? onSit : undefined}
        style={{ width: callToAction ? 'min(52vw, 200px)' : 'min(26vw, 164px)' }}
        aria-label={seatLabel}
      >
        <div className="seat-capsule-main flex flex-col items-center gap-1.5">
          <div className="seat-capsule-avatar-wrapper relative">
            <div
              className={clsx(
                'seat-capsule-avatar relative flex items-center justify-center rounded-full border-2 text-[11px] font-semibold uppercase shadow-sm',
                avatarTone,
                ringAccent,
              )}
              style={{ height: `${avatarSize + 10}px`, width: `${avatarSize + 10}px` }}
            >
              {isEmpty ? (
                <FontAwesomeIcon icon={faPlus} className="text-base opacity-80" />
              ) : (
                <span className="leading-none">{initials}</span>
              )}
            </div>
            <PositionBadge position={activePosition} />
          </div>

          {showDetailsInside && (
            <div className="seat-capsule-text flex flex-col items-center gap-0.5 text-center">
              <div className={clsx('seat-capsule-name max-w-[120px] truncate text-[11px] font-medium', hasFolded ? 'text-white/60' : 'text-white')}>
                {safeName}
              </div>
              {!isEmpty && !callToAction && (
                <div className="seat-capsule-stack flex items-center gap-1 text-[10px] font-normal text-slate-300">
                  <span className="seat-capsule-stack-chip-icon h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
                  <span className="tabular-nums">{formatChips(safeStack)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {(isEmpty || callToAction) && (
          <button
            type="button"
            disabled={disabled || !interactive}
            className={clsx(
              'seat-capsule-cta mt-1 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide shadow-lg transition-all',
              disabled
                ? 'bg-white/10 text-white/60'
                : 'bg-gradient-to-r from-emerald-400 to-emerald-300 text-emerald-950 hover:brightness-110',
            )}
          >
            {t('table.actions.takeSeat', { defaultValue: 'Sit at Table' })}
          </button>
        )}

        {showDetailsInside && !callToAction && !isEmpty && (
          <div className="seat-capsule-tags mt-0.5 flex flex-wrap items-center justify-center gap-1 text-[9px] uppercase tracking-[0.2em] text-white/80">
            {showYouBadge && (
              <span className="seat-capsule-tag flex items-center rounded-full bg-sky-400/80 px-2 py-0.5 font-black text-black shadow-sm">
                {t('table.players.youTag', { defaultValue: 'You' })}
              </span>
            )}
            {showFoldedLabel && hasFolded && (
              <span className="seat-capsule-tag flex items-center rounded-full bg-white/15 px-2 py-0.5 font-semibold text-[9px] text-white shadow">
                {t('table.folded', { defaultValue: 'FOLD' })}
              </span>
            )}
            {isSittingOut && !hasFolded && (
              <span className="seat-capsule-tag flex items-center rounded-full bg-white/20 px-2 py-0.5 font-semibold text-[9px] text-white/80 shadow">
                {t('table.sittingOut', { defaultValue: 'Sit out' })}
              </span>
            )}
            {isAllIn && (
              <span className="seat-capsule-tag flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 font-semibold text-[9px] text-rose-200 shadow-sm">
                {t('table.actions.allIn', { defaultValue: 'All-in' })}
              </span>
            )}
          </div>
        )}
      </div>
    )
  },
)

SeatCapsule.displayName = 'SeatCapsule'

export default SeatCapsule
