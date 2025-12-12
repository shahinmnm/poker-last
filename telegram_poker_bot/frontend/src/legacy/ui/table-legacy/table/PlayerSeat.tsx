import { forwardRef, useMemo } from 'react'
import clsx from 'clsx'
import { Plus } from 'lucide-react'
import PlayerCircularTimer from './PlayerCircularTimer'
import PlayingCard from '../../../../components/ui/PlayingCard'

type PositionLabel = 'BTN' | 'SB' | 'BB' | null | undefined
type SideDirection = 'top' | 'bottom' | 'left' | 'right'

export interface PlayerSeatProps {
  playerName: string
  chipCount: number
  seatLabel: string
  positionLabel?: PositionLabel
  isHero: boolean
  isActive: boolean
  hasFolded: boolean
  isSittingOut: boolean
  isAllIn: boolean
  turnDeadline?: string | null
  turnTotalSeconds?: number | null
  holeCards?: string[]
  showCardBacks?: boolean
  isEmpty?: boolean
  onClick?: () => void
  className?: string
  /** Seat direction for 4-directional layout (gravity towards table center) */
  side?: SideDirection
}

const formatChips = (value: number): string => {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${value}`
}

/** 4-Directional Layout Configuration - Gravity towards table center */
const layoutConfig: Record<SideDirection, {
  container: string
  cardWrapper: string
  badge: string
  infoPill: string
}> = {
  bottom: {
    container: 'flex-col-reverse items-center justify-end',
    cardWrapper: '-mb-3 -translate-y-4 z-0',
    badge: '-top-1 -right-1',
    infoPill: 'left-1/2 top-full -translate-y-2',
  },
  top: {
    container: 'flex-col items-center justify-start',
    cardWrapper: '-mt-3 translate-y-4 z-0',
    badge: '-bottom-1 -right-1',
    infoPill: 'left-1/2 top-full -translate-y-2',
  },
  left: {
    container: 'flex-row items-center',
    cardWrapper: '-ml-3 translate-x-3 z-0',
    badge: '-top-1 -right-1',
    infoPill: 'left-1/2 -translate-x-1/2 top-full -translate-y-2',
  },
  right: {
    container: 'flex-row-reverse items-center',
    cardWrapper: '-mr-3 -translate-x-3 z-0',
    badge: '-top-1 -left-1',
    infoPill: 'left-1/2 -translate-x-1/2 top-full -translate-y-2',
  },
}

/** Translate offset for card fanning (equivalent to Tailwind's translate-1) */
const CARD_FAN_OFFSET = 4

/** Calculate card rotation based on side direction - Perspective Fix */
const getCardRotation = (side: SideDirection, index: number): { rotation: number; translateX: number; translateY: number } => {
  const isFirstCard = index === 0

  switch (side) {
    case 'bottom':
      // Hero: Fan Upwards
      // Left Card: rotate-[-12deg] -translate-y-1
      // Right Card: rotate-[12deg] -translate-y-1
      return {
        rotation: isFirstCard ? -12 : 12,
        translateX: 0,
        translateY: -CARD_FAN_OFFSET,
      }
    case 'top':
      // Villain Opposite: Fan Downwards
      // Left Card: rotate-[12deg] translate-y-1
      // Right Card: rotate-[-12deg] translate-y-1
      return {
        rotation: isFirstCard ? 12 : -12,
        translateX: 0,
        translateY: CARD_FAN_OFFSET,
      }
    case 'left':
      // Villain Left: Fan Rightwards
      // Top Card: rotate-[12deg] translate-x-1
      // Bottom Card: rotate-[-12deg] translate-x-1
      return {
        rotation: isFirstCard ? 12 : -12,
        translateX: CARD_FAN_OFFSET,
        translateY: 0,
      }
    case 'right':
      // Villain Right: Fan Leftwards
      // Top Card: rotate-[-12deg] -translate-x-1
      // Bottom Card: rotate-[12deg] -translate-x-1
      return {
        rotation: isFirstCard ? -12 : 12,
        translateX: -CARD_FAN_OFFSET,
        translateY: 0,
      }
  }
}

const PlayerSeat = forwardRef<HTMLDivElement, PlayerSeatProps>(
  (
    {
      playerName,
      chipCount,
      seatLabel,
      positionLabel,
      isHero,
      isActive,
      hasFolded,
      isSittingOut,
      isAllIn,
      turnDeadline = null,
      turnTotalSeconds = null,
      holeCards = [],
      showCardBacks = false,
      isEmpty = false,
      onClick,
      className,
      side = 'bottom',
    },
    ref,
  ) => {
    const initial = useMemo(
      () => (playerName?.charAt(0)?.toUpperCase() || '?'),
      [playerName],
    )

    const layout = layoutConfig[side]

    if (isEmpty) {
      return (
        <div
          ref={ref}
          className={clsx('relative inline-flex flex-col items-center group cursor-pointer m-1.5', className)}
          onClick={onClick}
          role="button"
          tabIndex={0}
          aria-label={seatLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onClick?.()
            }
          }}
        >
          <div className="h-12 w-12 rounded-full border border-dashed border-white/30 flex items-center justify-center bg-white/5 transition-all duration-300 group-hover:border-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-105 shadow-inner">
            <Plus className="w-5 h-5 text-white/50 group-hover:text-emerald-300 transition-colors" strokeWidth={3} />
          </div>
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300 bg-black/80 px-2 py-0.5 rounded-full backdrop-blur-md border border-white/10 shadow-lg">
              Sit Here
            </span>
          </div>
        </div>
      )
    }

    const showFaces = holeCards.length > 0 && !showCardBacks
    const totalTime = typeof turnTotalSeconds === 'number' ? turnTotalSeconds : null
    const showTimer = isActive && Boolean(turnDeadline) && totalTime !== null && totalTime > 0
    const fallbackCardCount = holeCards.length > 0 ? holeCards.length : 2
    const safeCards = showFaces ? holeCards : Array(fallbackCardCount).fill('XX')
    const cardsHidden = !showFaces
    const mutedState = hasFolded || isSittingOut
    const isHorizontal = side === 'left' || side === 'right'

    return (
      <div
        ref={ref}
        className={clsx(
          'relative flex items-center transition-all duration-300 m-1',
          layout.container,
          mutedState && 'grayscale opacity-50',
          className,
        )}
        style={{
          width: isHorizontal ? '100px' : '86px',
          height: isHorizontal ? '86px' : '104px',
          zIndex: isActive ? 30 : 20,
        }}
        aria-label={seatLabel}
      >
        {/* AVATAR (The Centerpiece) */}
        <div className="relative z-20 flex items-center justify-center">
          <div className="relative flex h-12 w-12 items-center justify-center">
            {showTimer && turnDeadline && totalTime !== null && (
              <PlayerCircularTimer
                deadline={turnDeadline}
                totalSeconds={totalTime}
                size={48}
                strokeWidth={3}
                className="absolute inset-0 drop-shadow-[0_0_10px_rgba(16,185,129,0.55)]"
              />
            )}

            <div
              className={clsx(
                'relative flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/90 text-sm font-bold text-white ring-2 ring-white/15 shadow-xl',
                isActive && 'ring-emerald-400/90 shadow-emerald-500/30',
                isHero && !isActive && 'ring-amber-200/70',
              )}
            >
              <span>{initial}</span>

              {isAllIn && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-lg z-20">
                  ALL-IN
                </span>
              )}
            </div>

            {/* Dealer/Blind Badge (Dynamic Position) */}
            {positionLabel === 'BTN' && (
              <span className={clsx('absolute z-30 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-black text-slate-900 shadow', layout.badge)}>
                D
              </span>
            )}

            {positionLabel && positionLabel !== 'BTN' && (
              <span className={clsx('absolute z-30 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-white/90 px-1 text-[8px] font-black uppercase tracking-wide text-slate-900 shadow', layout.badge)}>
                {positionLabel}
              </span>
            )}

            {isSittingOut && (
              <div className="absolute -top-1.5 -right-1.5 z-30">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 shadow-lg ring ring-black/60">
                  <span className="text-[8px] font-bold text-black">Zz</span>
                </div>
              </div>
            )}
          </div>

          {/* INFO PILL (Floating Badge) */}
          <div
            className={clsx(
              'pointer-events-none absolute z-30 flex -translate-x-1/2 items-center justify-center',
              layout.infoPill,
            )}
          >
            <div className="flex flex-col items-center rounded-full border border-white/10 bg-black/80 px-2.5 py-1 shadow-lg backdrop-blur-sm">
              <div className="text-[10px] font-semibold text-gray-200 truncate max-w-[70px] leading-none">
                {playerName || seatLabel}
              </div>
              <div className="text-[10px] font-bold text-emerald-400 leading-tight">
                {formatChips(chipCount)}
              </div>
            </div>
          </div>
        </div>

        {/* CARDS (The Dynamic Layer) */}
        {safeCards.length > 0 && (
          <div className={clsx('relative z-10 transform scale-90 pointer-events-none drop-shadow-md', layout.cardWrapper)}>
            <div className={clsx('flex items-center justify-center gap-1.5', isHorizontal && 'flex-col')}>
              {safeCards.map((card, index) => {
                const { rotation, translateX, translateY } = getCardRotation(side, index)
                return (
                  <div
                    key={`${card}-${index}`}
                    style={{
                      transform: `rotate(${rotation}deg) translateX(${translateX}px) translateY(${translateY}px)`,
                    }}
                  >
                    <PlayingCard
                      card={cardsHidden ? 'XX' : card}
                      hidden={cardsHidden}
                      size="sm"
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  },
)

PlayerSeat.displayName = 'PlayerSeat'

export default PlayerSeat
