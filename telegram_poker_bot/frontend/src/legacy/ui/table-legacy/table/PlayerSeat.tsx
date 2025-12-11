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
    container: 'flex-col justify-end',
    cardWrapper: '-mb-8 z-0',
    badge: '-top-1 -right-1',
    infoPill: '-bottom-6 left-1/2 -translate-x-1/2',
  },
  top: {
    container: 'flex-col justify-start',
    cardWrapper: '-mt-8 z-0',
    badge: '-bottom-1 -right-1',
    infoPill: '-top-6 left-1/2 -translate-x-1/2',
  },
  left: {
    container: 'flex-row items-center',
    cardWrapper: '-ml-6 z-0',
    badge: '-top-1 -right-1',
    infoPill: '-left-2 top-1/2 -translate-y-1/2 -translate-x-full',
  },
  right: {
    container: 'flex-row-reverse items-center',
    cardWrapper: '-mr-6 z-0',
    badge: '-top-1 -left-1',
    infoPill: '-right-2 top-1/2 -translate-y-1/2 translate-x-full',
  },
}

/** Calculate card rotation based on side direction */
const getCardRotation = (side: SideDirection, index: number, totalCards: number): { rotation: number; translateX: number } => {
  const midpoint = totalCards / 2
  const isFirstHalf = index < midpoint

  switch (side) {
    case 'top':
    case 'bottom':
      return {
        rotation: isFirstHalf ? -6 : 6,
        translateX: isFirstHalf ? 1 : -1,
      }
    case 'left':
      return {
        rotation: isFirstHalf ? 0 : 10,
        translateX: 0,
      }
    case 'right':
      return {
        rotation: isFirstHalf ? 0 : -10,
        translateX: 0,
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
          className={clsx('relative inline-flex flex-col items-center group cursor-pointer', className)}
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
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-white/5 transition-all duration-300 group-hover:border-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-105 shadow-inner">
            <Plus className="w-6 h-6 text-white/40 group-hover:text-emerald-400 transition-colors" strokeWidth={3} />
          </div>
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-black/80 px-2 py-0.5 rounded-full backdrop-blur-md">
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
          'relative flex items-center transition-all duration-300',
          layout.container,
          mutedState && 'grayscale opacity-50',
          className,
        )}
        style={{
          width: isHorizontal ? '120px' : '90px',
          height: isHorizontal ? '90px' : '120px',
          zIndex: isActive ? 30 : 20,
        }}
        aria-label={seatLabel}
      >
        {/* INFO PILL (Floating Badge) */}
        <div
          className={clsx(
            'absolute z-30 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 shadow-lg text-center whitespace-nowrap',
            layout.infoPill,
          )}
        >
          <div className="text-[9px] font-bold text-gray-300 truncate max-w-[70px] leading-none">
            {playerName || seatLabel}
          </div>
          <div className="text-[10px] font-mono font-bold text-emerald-400 leading-none">
            {formatChips(chipCount)}
          </div>
        </div>

        {/* AVATAR (The Centerpiece) */}
        <div className="relative z-20">
          <div className="relative flex h-14 w-14 items-center justify-center">
            {showTimer && turnDeadline && totalTime !== null && (
              <PlayerCircularTimer
                deadline={turnDeadline}
                totalSeconds={totalTime}
                size={56}
                strokeWidth={3}
                className="absolute inset-0"
              />
            )}

            <div
              className={clsx(
                'relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white border-2 border-white/10 shadow-2xl',
                isActive && 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-black',
                isHero && !isActive && 'ring-2 ring-amber-200/80',
              )}
            >
              <span>{initial}</span>

              {isAllIn && (
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg z-20">
                  ALL-IN
                </span>
              )}
            </div>

            {/* Dealer/Blind Badge (Dynamic Position) */}
            {positionLabel === 'BTN' && (
              <span className={clsx('absolute z-30 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[9px] font-black text-slate-900 shadow', layout.badge)}>
                D
              </span>
            )}

            {positionLabel && positionLabel !== 'BTN' && (
              <span className={clsx('absolute z-30 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-white/90 px-1 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow', layout.badge)}>
                {positionLabel}
              </span>
            )}

            {isSittingOut && (
              <div className="absolute -top-2 -right-2 z-30">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 shadow-lg ring-2 ring-black">
                  <span className="text-[10px] font-bold text-black">Zzz</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CARDS (The Dynamic Layer) */}
        {safeCards.length > 0 && (
          <div className={clsx('relative z-10 transform scale-90 pointer-events-none', layout.cardWrapper)}>
            <div className={clsx('flex items-center justify-center', isHorizontal && 'flex-col')}>
              {safeCards.map((card, index) => {
                const { rotation, translateX } = getCardRotation(side, index, safeCards.length)
                return (
                  <div
                    key={`${card}-${index}`}
                    style={{
                      transform: `rotate(${rotation}deg) translateX(${translateX}px)`,
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
