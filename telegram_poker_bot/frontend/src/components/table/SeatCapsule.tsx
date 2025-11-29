import { forwardRef, useMemo } from 'react'
import type { ReactNode } from 'react'
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
const HERO_SCALE = 1.08

type TablePosition = 'BTN' | 'SB' | 'BB' | null | undefined

function PositionBadge({ position }: { position: TablePosition }) {
  if (!position) return null

  const badgeClasses = clsx(
    'seat-position-badge',
    'absolute -right-1 bottom-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold uppercase tracking-[0.2em] shadow-sm',
    position === 'BTN' && 'seat-position-badge--btn bg-amber-300 text-amber-900',
    position === 'SB' && 'seat-position-badge--sb bg-sky-400 text-sky-950',
    position === 'BB' && 'seat-position-badge--bb bg-purple-400 text-purple-950',
  )

  return <span className={badgeClasses}>{position}</span>
}

type SeatTimerRingProps = {
  children: ReactNode
  progress?: number
}

function SeatTimerRing({ children, progress = 1 }: SeatTimerRingProps) {
  const safeProgress = Math.min(Math.max(progress ?? 1, 0), 1)
  const degrees = Math.round(safeProgress * 360)

  return (
    <div className="seat-timer-shell relative flex items-center justify-center overflow-visible rounded-full p-[6px]">
      <span
        className="seat-capsule-timer-ring absolute inset-0 z-0 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full"
        style={{
          backgroundImage: `conic-gradient(#ff6347 ${degrees}deg, rgba(255,255,255,0.08) ${degrees}deg 360deg)`,
          boxShadow: '0 0 0 3px rgba(255,99,71,0.6)',
        }}
        aria-hidden="true"
      />
      <span className="relative z-10 flex items-center justify-center rounded-full">{children}</span>
    </div>
  )
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
    const avatarDiameter = Math.round((avatarSize + 8) * (isHero ? HERO_SCALE : 1))
    const showDetailsInside = detailsPlacement === 'inside'
    const opacityState = hasFolded ? 'opacity-60' : 'opacity-100'
    const isActiveTurn = isActive

    const avatarTone = useMemo(() => {
      if (callToAction) return 'border-emerald-200/90 bg-emerald-400/10 text-emerald-50'
      if (isEmpty) return 'border-white/60 bg-white/10 text-white'
      if (isHero) return 'border-cyan-100/80 bg-gradient-to-br from-white/15 via-cyan-200/10 to-white/10'
      return 'border-white/40 bg-white/10'
    }, [callToAction, isEmpty, isHero])

    const safeName = name || seatLabel
    const safeStack = Number.isFinite(stack) ? stack : 0
    const normalizedPosition = (positionLabel ?? '').toUpperCase()
    const activePosition = (['BTN', 'SB', 'BB'] as TablePosition[]).includes(
      normalizedPosition as TablePosition,
    )
      ? (normalizedPosition as TablePosition)
      : undefined

    const frameAccentClass = isHero
      ? 'shadow-[0_0_0_2px_rgba(34,211,238,0.5)] ring-2 ring-cyan-200/30 shadow-cyan-300/40'
      : 'shadow-[0_0_0_1.5px_rgba(0,0,0,0.35)]'

    const avatarFrameClasses = clsx(
      'seat-capsule-avatar-frame relative flex items-center justify-center rounded-full border-2 text-[12px] font-semibold uppercase shadow-sm transition-colors',
      avatarTone,
      !isActiveTurn && frameAccentClass,
      hasFolded && 'grayscale',
    )

    const avatarCircle = (
      <div
        className={avatarFrameClasses}
        style={{ height: `${avatarDiameter}px`, width: `${avatarDiameter}px` }}
      >
        {isEmpty ? (
          <FontAwesomeIcon icon={faPlus} className="text-base opacity-80" />
        ) : (
          <span className="leading-none">{initials}</span>
        )}
        <PositionBadge position={activePosition} />
      </div>
    )

    const heroBadge =
      showYouBadge && !isEmpty ? (
        <span className="seat-capsule-hero-badge absolute -left-1.5 -bottom-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-md">
          ★
        </span>
      ) : null

    const detailsNode = (
      <div className="seat-capsule-text flex flex-col items-center gap-0.5 text-center">
        <div
          className={clsx(
            'seat-capsule-name max-w-[140px] truncate text-[12px] font-semibold leading-tight',
            hasFolded ? 'text-white/50' : 'text-white',
          )}
          title={safeName}
        >
          {safeName}
        </div>
        {!isEmpty && !callToAction && (
          <div className="seat-capsule-stack flex items-center gap-1 text-[11px] font-semibold text-slate-100">
            <span className="seat-capsule-stack-chip h-1.5 w-1.5 rounded-full bg-amber-300 shadow-sm" aria-hidden="true" />
            <span className="tabular-nums">{formatChips(safeStack)}</span>
          </div>
        )}
      </div>
    )

    const tagsNode =
      !callToAction && !isEmpty ? (
        <div className="seat-capsule-tags mt-0.5 flex flex-wrap items-center justify-center gap-1 text-[9px] uppercase tracking-[0.2em] text-white/80">
          {showFoldedLabel && hasFolded && (
            <span className="seat-capsule-tag seat-capsule-tag--muted flex items-center rounded-full bg-white/10 px-2 py-0.5 font-semibold text-[9px] text-white/80 shadow">
              {t('table.folded', { defaultValue: 'FOLD' })}
            </span>
          )}
          {isSittingOut && !hasFolded && (
            <span className="seat-capsule-tag seat-capsule-tag--muted flex items-center rounded-full bg-white/20 px-2 py-0.5 font-semibold text-[9px] text-white/80 shadow">
              {t('table.sittingOut', { defaultValue: 'Sit out' })}
            </span>
          )}
          {isAllIn && (
            <span className="seat-capsule-tag seat-capsule-tag--alert flex items-center rounded-full bg-rose-500/20 px-2 py-0.5 font-semibold text-[9px] text-rose-200 shadow-sm">
              {t('table.actions.allIn', { defaultValue: 'All-in' })}
            </span>
          )}
        </div>
      ) : null

    const rootClasses = clsx(
      'seat-capsule relative flex w-full min-w-[104px] max-w-[200px] flex-col items-center gap-1 text-slate-50 transition-transform duration-300',
      {
        'cursor-pointer hover:-translate-y-1': interactive,
        'cursor-default': !interactive,
      },
      opacityState,
      isHero && 'seat-capsule--hero',
      isActiveTurn && 'seat-capsule--active',
      hasFolded && 'seat-capsule--folded',
    )

    return (
      <div
        ref={ref}
        className={rootClasses}
        onClick={interactive ? onSit : undefined}
        style={{ width: callToAction ? 'min(52vw, 200px)' : 'min(26vw, 164px)' }}
        aria-label={seatLabel}
      >
        <div className="seat-capsule-body flex flex-col items-center gap-1">
          <div className="seat-capsule-avatar-wrapper relative flex items-center justify-center">
            {isActiveTurn ? <SeatTimerRing>{avatarCircle}</SeatTimerRing> : avatarCircle}
            {heroBadge}
          </div>

          {showDetailsInside && (
            <>
              {detailsNode}
              {tagsNode}
            </>
          )}
        </div>

        {!showDetailsInside && (
          <div className="seat-capsule-details seat-capsule-details--outside flex flex-col items-center gap-1 text-center">
            {detailsNode}
            {tagsNode}
          </div>
        )}

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
      </div>
    )
  },
)

SeatCapsule.displayName = 'SeatCapsule'

export default SeatCapsule
