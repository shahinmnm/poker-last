import { forwardRef, useMemo } from 'react'
import clsx from 'clsx'
import { Plus } from 'lucide-react'
import PlayerCircularTimer from './PlayerCircularTimer'
import PlayingCard from '../../../../components/ui/PlayingCard'

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
  isEmpty?: boolean
  onClick?: () => void
  className?: string
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
      isEmpty = false,
      onClick,
      className,
    },
    ref,
  ) => {
    // All hooks must be called unconditionally (before the isEmpty early return below)
    const initial = useMemo(
      () => (playerName?.charAt(0)?.toUpperCase() || '?'),
      [playerName],
    )

    // If empty seat, render a professional Plus icon seat
    if (isEmpty) {
      const seatClasses = 'relative inline-flex flex-col items-center'
      return (
        <div
          ref={ref}
          className={clsx(seatClasses, className, 'group cursor-pointer')}
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
          {/* Dashed Ring with Plus Icon */}
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center bg-white/5 transition-all duration-300 group-hover:border-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-105 shadow-inner">
            <Plus className="w-6 h-6 text-white/40 group-hover:text-emerald-400 transition-colors" strokeWidth={3} />
          </div>
          
          {/* "Open" Label */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-black/80 px-2 py-0.5 rounded-full backdrop-blur-md">
              Sit Here
            </span>
          </div>
        </div>
      )
    }

    // Support variable number of hole cards for different variants
    // Hold'em: 2, Omaha: 4, Draw games: 5
    const showFaces = holeCards.length > 0 && !showCardBacks
    const totalTime = typeof turnTotalSeconds === 'number' ? turnTotalSeconds : null
    const showTimer =
      isActive && Boolean(turnDeadline) && totalTime !== null && totalTime > 0
    
    const fallbackCardCount = holeCards.length > 0 ? holeCards.length : 2
    const safeCards = showFaces ? holeCards : Array(fallbackCardCount).fill('XX')
    const cardsHidden = !showFaces

    const mutedState = hasFolded || isSittingOut

    return (
      <div
        ref={ref}
        className={clsx(
          'relative flex w-20 flex-col items-center justify-center transition-all duration-300',
          mutedState && 'grayscale opacity-50',
          className,
        )}
        style={{ zIndex: isActive ? 30 : 20 }}
        aria-label={seatLabel}
      >
        {/* Avatar */}
        <div className="relative z-10 flex items-center justify-center">
          <div className="relative flex h-[66px] w-[66px] items-center justify-center">
            {showTimer && turnDeadline && totalTime !== null && (
              <PlayerCircularTimer
                deadline={turnDeadline}
                totalSeconds={totalTime}
                size={66}
                strokeWidth={3}
                className="absolute inset-0"
              />
            )}

            <div
              className={clsx(
                'relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white shadow-[0_12px_26px_rgba(0,0,0,0.45)] ring-[2.5px] ring-white/20',
                isHero && 'ring-2 ring-amber-200/80',
              )}
            >
              <span>{initial}</span>

              {isAllIn && (
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
                  ALL-IN
                </span>
              )}

              {positionLabel && (
                <span className="absolute -right-1 -top-1 z-20 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-white/90 px-1 text-[9px] font-black uppercase tracking-wide text-slate-900 shadow">
                  {positionLabel}
                </span>
              )}

              {/* Zzz Badge for Sitting Out players */}
              {isSittingOut && (
                <div className="absolute -top-2 -right-2 z-20">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 shadow-lg ring-2 ring-black">
                    <span className="text-[10px] font-bold text-black">Zzz</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Compact Info Pill */}
        <div className="-mt-3 z-20 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 shadow-lg text-center min-w-[70px]">
          <div className="text-[9px] font-bold text-gray-200 truncate leading-none mb-0.5">
            {playerName || seatLabel}
          </div>
          <div className="text-[10px] font-mono font-bold text-emerald-400 leading-none">
            {formatChips(chipCount)}
          </div>
        </div>

        {/* Hole Cards */}
        {safeCards.length > 0 && (
          <div className="-mt-2 z-30 transform scale-75 origin-top hover:scale-90 transition-transform pointer-events-none">
            <div className="flex gap-1 justify-center">
              {safeCards.map((card, index) => (
                <PlayingCard
                  key={`${card}-${index}`}
                  card={cardsHidden ? 'XX' : card}
                  hidden={cardsHidden}
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
)

PlayerSeat.displayName = 'PlayerSeat'

export default PlayerSeat
