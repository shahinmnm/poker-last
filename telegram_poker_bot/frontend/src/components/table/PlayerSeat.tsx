import { forwardRef, useMemo } from 'react'
import clsx from 'clsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins } from '@fortawesome/free-solid-svg-icons'
import PlayerCircularTimer from './PlayerCircularTimer'
import PlayingCard from '../ui/PlayingCard'

type PositionLabel = 'BTN' | 'SB' | 'BB' | null | undefined

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
  turnProgress?: number | null
  turnDeadline?: string | null
  turnTotalSeconds?: number | null
  holeCards?: string[]
  showCardBacks?: boolean
}

const formatChips = (value: number): string => {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `${value}`
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
    },
    ref,
  ) => {
    const initial = useMemo(
      () => (playerName?.charAt(0)?.toUpperCase() || '?'),
      [playerName],
    )

    // Support variable number of hole cards for different variants
    // Hold'em: 2, Omaha: 4, Draw games: 5
    const showFaces = holeCards.length > 0 && !showCardBacks
    const totalTime = typeof turnTotalSeconds === 'number' ? turnTotalSeconds : null
    const showTimer =
      isActive && Boolean(turnDeadline) && totalTime !== null && totalTime > 0
    
    // Note: Default fallback to 2 cards for backwards compatibility
    // In future, variant info should be passed to this component for proper fallback
    // (e.g., 4 cards for Omaha, 5 cards for Draw)
    const safeCards = showFaces ? holeCards : Array(2).fill('XX')
    const cardsHidden = !showFaces

    const mutedState = hasFolded || isSittingOut

    return (
      <div
        ref={ref}
        className={clsx(
          'relative inline-flex w-[180px] flex-col items-center -space-y-2',
          mutedState && 'grayscale opacity-50',
        )}
        aria-label={seatLabel}
      >
        {/* Avatar + card fan row */}
        <div className="flex items-center justify-center gap-1 -ml-2">
          <div className="relative flex items-center justify-center">
            <div className="relative h-16 w-16 flex items-center justify-center z-20">
              {showTimer && turnDeadline && totalTime !== null && (
                <PlayerCircularTimer
                  deadline={turnDeadline}
                  totalSeconds={totalTime}
                  size={66}
                  strokeWidth={3}
                  className="z-0 h-[66px] w-[66px]"
                />
              )}

              <div
                className={clsx(
                  'relative z-20 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white shadow-[0_12px_26px_rgba(0,0,0,0.45)] ring-[2.5px] ring-white/20',
                  isHero && 'ring-2 ring-amber-200/80',
                )}
              >
                <span>{initial}</span>

                {isAllIn && (
                  <span className="absolute -bottom-3 right-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
                    ALL-IN
                  </span>
                )}

                {positionLabel && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-white/90 px-1 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow">
                    {positionLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="pointer-events-none relative flex h-18 w-[120px] items-center justify-center z-10 -ml-2">
            {safeCards.map((card, index) => {
              // Calculate rotation and position based on card count
              const cardCount = safeCards.length
              const baseRotation = cardCount === 2 ? 8 : cardCount === 4 ? 6 : 5
              const spreadFactor = cardCount === 2 ? 15 : cardCount === 4 ? 12 : 10
              
              // Center the cards and spread them evenly
              const centerOffset = (cardCount - 1) / 2
              const rotationAngle = (index - centerOffset) * baseRotation
              const xOffset = (index - centerOffset) * spreadFactor
              
              return (
                <div
                  key={`${card}-${index}`}
                  className="absolute origin-bottom"
                  style={{
                    transform: `translateX(${xOffset}px) rotate(${rotationAngle}deg)`,
                    zIndex: 10 + index,
                  }}
                >
                  <PlayingCard card={cardsHidden ? 'XX' : card} hidden={cardsHidden} size="sm" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Labels */}
        <div className="flex flex-col items-center leading-tight space-y-0.5 mt-2">
          <span className="text-[12px] font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
            {playerName || seatLabel}
          </span>
          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
            <FontAwesomeIcon icon={faCoins} className="h-3 w-3 text-amber-300" />
            <span className="tabular-nums">{formatChips(chipCount)}</span>
          </div>
        </div>
      </div>
    )
  },
)

PlayerSeat.displayName = 'PlayerSeat'

export default PlayerSeat
