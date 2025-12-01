import { forwardRef, useMemo } from 'react'
import clsx from 'clsx'
import PlayerCircularTimer from './PlayerCircularTimer'

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

const CARD_BASE =
  'absolute h-14 w-10 rounded-[6px] border border-slate-200 bg-white text-slate-900 shadow-[0_14px_32px_rgba(0,0,0,0.35)] flex items-center justify-center text-[11px] font-semibold overflow-hidden'

const renderCardFace = (card?: string) => {
  if (!card || card.length < 2) return null
  const rank = card.slice(0, -1).toUpperCase()
  const suit = card.slice(-1).toLowerCase()
  const suitIcon =
    suit === 'h' ? '♥' : suit === 'd' ? '♦' : suit === 'c' ? '♣' : suit === 's' ? '♠' : '★'
  const isRed = suit === 'h' || suit === 'd'

  return (
    <div className="relative h-full w-full px-1.5 py-1">
      <span
        className={clsx(
          'absolute left-1 top-1 text-[11px] font-bold leading-none',
          isRed ? 'text-rose-600' : 'text-slate-900',
        )}
      >
        {rank}
      </span>
      <span
        className={clsx(
          'absolute right-1 bottom-1 text-[11px] font-bold leading-none',
          isRed ? 'text-rose-600' : 'text-slate-900',
        )}
      >
        {suitIcon}
      </span>
      <div
        className={clsx(
          'flex h-full items-center justify-center text-xl font-semibold',
          isRed ? 'text-rose-500' : 'text-slate-800',
        )}
      >
        {suitIcon}
      </div>
    </div>
  )
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

    const showFaces = holeCards.length >= 2 && !showCardBacks
    const totalTime = typeof turnTotalSeconds === 'number' ? turnTotalSeconds : null
    const showTimer =
      isActive && Boolean(turnDeadline) && totalTime !== null && totalTime > 0

    const mutedState = hasFolded || isSittingOut

    return (
      <div
        ref={ref}
        className={clsx(
          'relative inline-block h-[100px] w-[188px]',
          mutedState && 'grayscale opacity-50',
        )}
        aria-label={seatLabel}
      >
        {/* Avatar */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 relative">
          <div className="relative h-16 w-16">
            {showTimer && turnDeadline && totalTime !== null && (
              <PlayerCircularTimer
                deadline={turnDeadline}
                totalSeconds={totalTime}
                className="z-30 h-20 w-20"
              />
            )}

            <div
              className={clsx(
                'relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-slate-900 text-base font-bold text-white shadow-[0_14px_32px_rgba(0,0,0,0.45)] ring-2 ring-white/20',
                isHero && 'ring-2 ring-amber-300/90 shadow-amber-400/25',
              )}
            >
              <span>{initial}</span>

              {isAllIn && (
                <span className="absolute -bottom-3 right-0 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">
                  ALL-IN
                </span>
              )}

              {positionLabel && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/90 px-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-900 shadow">
                  {positionLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card fan */}
        <div className="pointer-events-none absolute left-[60px] top-1/2 -translate-y-1/2 z-10">
          <div className="relative flex h-16 w-[96px] items-end justify-center">
            {holeCards.slice(0, 2).map((card, index) => {
              const isBackCard = index === 0

              return (
                <div
                  key={`${card}-${index}`}
                  className={clsx(
                    CARD_BASE,
                    isBackCard
                      ? 'z-10 -rotate-[8deg] origin-bottom'
                      : 'z-20 rotate-[8deg] translate-x-[15px] origin-bottom',
                    !showFaces && showCardBacks && 'bg-gradient-to-br from-white to-slate-100 text-slate-700',
                  )}
                >
                  {showFaces ? renderCardFace(card) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* Labels */}
        <div className="absolute bottom-1 left-0 right-0 flex items-center justify-between px-1">
          <div className="flex flex-col leading-tight">
            <span className="text-[13px] font-semibold text-white drop-shadow-sm">
              {playerName || seatLabel}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100/80">
              {seatLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-100/90">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            <span className="tabular-nums">{formatChips(chipCount)}</span>
          </div>
        </div>
      </div>
    )
  },
)

PlayerSeat.displayName = 'PlayerSeat'

export default PlayerSeat
