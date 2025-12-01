import { forwardRef, useMemo } from 'react'
import clsx from 'clsx'

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
  'absolute h-16 w-12 rounded-xl border border-white/25 bg-white text-slate-900 shadow-[0_10px_24px_rgba(0,0,0,0.45)] flex items-center justify-center text-sm font-semibold'

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
      turnProgress = null,
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
    const progress =
      turnProgress === null || turnProgress === undefined
        ? null
        : Math.max(0, Math.min(1, turnProgress > 1 ? turnProgress / 100 : turnProgress))

    const ringStyle =
      progress !== null
        ? {
            background: `conic-gradient(#22d3ee ${Math.round(progress * 360)}deg, rgba(255,255,255,0.08) 0deg)`,
          }
        : undefined

    const mutedState = hasFolded || isSittingOut

    return (
      <div
        ref={ref}
        className={clsx(
          'relative inline-block h-[84px] w-[156px]',
          mutedState && 'grayscale opacity-50',
        )}
        aria-label={seatLabel}
      >
        {/* Avatar */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <div className="relative h-16 w-16">
            <div
              className={clsx(
                'relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white shadow-[0_14px_32px_rgba(0,0,0,0.45)] ring-2 ring-white/20',
                isHero && 'ring-2 ring-amber-300/90 shadow-amber-400/25',
                isActive &&
                  'shadow-[0_0_24px_rgba(56,189,248,0.55)] ring-2 ring-cyan-300/90',
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

            {progress !== null && (
              <div
                className="pointer-events-none absolute inset-[-6px] rounded-full p-[2px]"
                style={ringStyle}
              >
                <div className="h-full w-full rounded-full bg-slate-950/80" />
              </div>
            )}
          </div>
        </div>

        {/* Card fan */}
        <div className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2">
          {/* Back card */}
          <div
            className={clsx(
              CARD_BASE,
              'left-5 top-0 rotate-[15deg] bg-gradient-to-br from-slate-900 to-slate-800 text-white',
              showFaces && 'bg-white text-slate-900',
              !showFaces && showCardBacks && 'bg-[radial-gradient(circle_at_30%_30%,_rgba(59,130,246,0.45),_rgba(15,23,42,0.95))]',
            )}
            style={{ zIndex: 1 }}
          >
            {showFaces ? holeCards[1] : showCardBacks ? '' : null}
          </div>

          {/* Front card */}
          <div
            className={clsx(
              CARD_BASE,
              'left-0 top-2 rotate-[5deg] bg-gradient-to-br from-slate-800 to-slate-900 text-white',
              showFaces && 'bg-white text-slate-900',
              !showFaces && showCardBacks && 'bg-[radial-gradient(circle_at_30%_30%,_rgba(59,130,246,0.45),_rgba(15,23,42,0.95))]',
            )}
            style={{ zIndex: 2 }}
          >
            {showFaces ? holeCards[0] : showCardBacks ? '' : null}
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
