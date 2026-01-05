import { forwardRef, useMemo, useEffect, useState } from 'react'
import clsx from 'clsx'
import { Plus } from 'lucide-react'
import PlayerCircularTimer from './PlayerCircularTimer'
import PlayingCard from '../../../../components/ui/PlayingCard'
import { formatChips } from '../../../../utils/formatChips'
import LeavingIndicator from './LeavingIndicator'

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
  actionLabel?: string | null
  actionTrigger?: string | number | null
  turnDeadline?: string | null
  turnTotalSeconds?: number | null
  holeCards?: string[]
  showCardBacks?: boolean
  isEmpty?: boolean
  onClick?: () => void
  className?: string
  /** Seat direction for 4-directional layout (gravity towards table center) */
  side?: SideDirection
  /** PHASE 5: Whether hero seat should be in reduced scale mode (showdown/opponent turn) */
  heroScaleReduced?: boolean
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
    cardWrapper: 'player-seat__cards player-seat__cards--bottom',
    badge: '-top-1 -right-1',
    infoPill: 'left-1/2 top-full -translate-y-2',
  },
  top: {
    container: 'flex-col items-center justify-start',
    cardWrapper: 'player-seat__cards player-seat__cards--top',
    badge: '-bottom-1 -right-1',
    infoPill: 'left-1/2 top-full -translate-y-2',
  },
  left: {
    container: 'flex-row items-center',
    cardWrapper: 'player-seat__cards player-seat__cards--left',
    badge: '-top-1 -right-1',
    infoPill: 'left-1/2 -translate-x-1/2 top-full -translate-y-2',
  },
  right: {
    container: 'flex-row-reverse items-center',
    cardWrapper: 'player-seat__cards player-seat__cards--right',
    badge: '-top-1 -left-1',
    infoPill: 'left-1/2 -translate-x-1/2 top-full -translate-y-2',
  },
}

/** Translate offset for card fanning (equivalent to Tailwind's translate-1) */
const CARD_FAN_OFFSET = 6
const HERO_CARD_OVERLAP_Y = -8

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
      actionLabel,
      actionTrigger,
      turnDeadline = null,
      turnTotalSeconds = null,
      holeCards = [],
      showCardBacks = false,
      isEmpty = false,
      onClick,
      className,
      side = 'bottom',
      heroScaleReduced = false,
    },
    ref,
  ) => {
    const initial = useMemo(
      () => (playerName?.charAt(0)?.toUpperCase() || '?'),
      [playerName],
    )

    const layout = layoutConfig[side]
    const seatSideClass = `player-seat--${side}`
    const [visibleAction, setVisibleAction] = useState<string | null>(null)
    const [isActionVisible, setIsActionVisible] = useState(false)
    const actionState = useMemo(() => {
      if (hasFolded) return 'Fold'
      if (isAllIn) return 'All-in'
      return null
    }, [hasFolded, isAllIn])

    // PHASE 5: Compute hero seat scale class based on UI mode
    // - Hero with full scale (isMyTurn): 'player-seat--hero-action'
    // - Hero with reduced scale (not isMyTurn): 'player-seat--hero-reduced'
    // - Non-hero: no additional class
    const getHeroScaleClass = (): string => {
      if (!isHero) return ''
      return heroScaleReduced ? 'player-seat--hero-reduced' : 'player-seat--hero-action'
    }

    // Show a transient action chip above the seat when an action is received
    useEffect(() => {
      if (!actionLabel) return
      setVisibleAction(actionLabel)
      setIsActionVisible(true)

      const fadeTimer = window.setTimeout(() => setIsActionVisible(false), 1200)
      const clearTimer = window.setTimeout(() => setVisibleAction(null), 1600)

      return () => {
        window.clearTimeout(fadeTimer)
        window.clearTimeout(clearTimer)
      }
    }, [actionLabel, actionTrigger])

    if (isEmpty) {
      return (
        <div
          ref={ref}
          className={clsx('player-seat__empty relative inline-flex flex-col items-center group cursor-pointer m-1.5', className)}
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
          <div className="player-seat__empty-ring rounded-full border border-dashed border-white/30 flex items-center justify-center bg-white/5 transition-all duration-300 group-hover:border-emerald-400 group-hover:bg-emerald-500/20 group-hover:scale-105 shadow-inner">
            <Plus className="player-seat__empty-icon text-white/50 group-hover:text-emerald-300 transition-colors" strokeWidth={3} />
          </div>
        </div>
      )
    }

    const showFaces = holeCards.length > 0 && !showCardBacks
    const totalTime = typeof turnTotalSeconds === 'number' ? turnTotalSeconds : null
    const showTimer = isActive && Boolean(turnDeadline) && totalTime !== null && totalTime > 0
    const showBacks = !showFaces && showCardBacks
    const safeCards = showFaces ? holeCards : showBacks ? Array(2).fill('XX') : []
    const cardsHidden = !showFaces
    const mutedState = hasFolded || isSittingOut
    const isHorizontal = side === 'left' || side === 'right'
    const seatOrientationClass = isHorizontal ? 'player-seat--horizontal' : 'player-seat--vertical'
    const heroScale = heroScaleReduced ? 0.9 : 1
    const seatScale = isHero ? heroScale : 1
    const depthTranslate = '0%'
    const heroScaleClass = getHeroScaleClass()

    return (
      <div
        ref={ref}
        className={clsx(
          'player-seat relative flex items-center transition-all duration-300 m-1',
          layout.container,
          seatSideClass,
          seatOrientationClass,
          isHero && 'player-seat--hero',
          isActive && 'player-seat--active',
          mutedState && 'player-seat--muted',
          heroScaleClass,
          className,
        )}
        style={{
          zIndex: isActive ? 30 : 20,
          transform: `scale(${seatScale}) translateY(${depthTranslate})`,
          transformOrigin: 'center bottom',
        }}
        aria-label={seatLabel}
      >
        {visibleAction && (
          <div
            className={clsx(
              'player-seat__action-callout pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide tabular-nums shadow-lg bg-black/80 transition-all duration-300',
              isActionVisible ? 'opacity-100 -translate-y-1' : 'opacity-0 -translate-y-2',
            )}
          >
            <span
              className="player-seat__action-chip rounded-full bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 shadow"
              aria-hidden
            />
            <span className="player-seat__action-text truncate">{visibleAction}</span>
          </div>
        )}
        {/* AVATAR (The Centerpiece) */}
        <div className="player-seat__avatar relative z-20 flex items-center justify-center">
          <div className="player-seat__avatar-frame relative flex items-center justify-center">
            {showTimer && turnDeadline && totalTime !== null && (
              <PlayerCircularTimer
                deadline={turnDeadline}
                totalSeconds={totalTime}
                size={42}
                strokeWidth={2}
                className="player-seat__timer absolute inset-0"
              />
            )}

            <div
              className={clsx(
                'player-seat__avatar-core relative flex items-center justify-center rounded-full text-sm font-bold',
                isActive && 'is-active',
                isHero && 'is-hero',
              )}
            >
              <span className="player-seat__initial">{initial}</span>

              {isAllIn && (
                <span className="player-seat__allin absolute -bottom-2 left-1/2 -translate-x-1/2">
                  ALL-IN
                </span>
              )}
            </div>

            {/* Dealer/Blind Badge (Dynamic Position) */}
            {positionLabel === 'BTN' && (
              <span className={clsx('player-seat__badge player-seat__badge--dealer absolute z-30 flex items-center justify-center rounded-full text-[8px] font-black shadow-md', layout.badge)}>
                D
              </span>
            )}

            {positionLabel && positionLabel !== 'BTN' && (
              <span className={clsx('player-seat__badge absolute z-30 flex items-center justify-center rounded-full px-1 text-[8px] font-black uppercase tracking-wide shadow', layout.badge)}>
                {positionLabel}
              </span>
            )}

            {isSittingOut && (
              <div className="player-seat__status absolute -top-1.5 -left-1.5 z-30">
                <LeavingIndicator />
              </div>
            )}
          </div>

          {/* INFO PILL (Floating Badge) - player name and stack */}
          <div
            className={clsx(
              'player-seat__info absolute z-30 flex -translate-x-1/2 items-center justify-center pointer-events-none',
              layout.infoPill,
            )}
          >
            <div className={clsx(
              'player-seat__info-card flex flex-col items-center rounded-xl px-3 py-1.5',
            )}>
              {/* Player name - primary text, truncated for hero */}
              <div 
                className="player-seat__name text-[11px] font-bold leading-tight overflow-hidden text-ellipsis whitespace-nowrap tracking-tight"
                style={{ maxWidth: isHero ? '24vw' : '30vw' }}
                dir="auto"
              >
                {playerName || seatLabel}
              </div>
              {/* Stack - secondary text, muted but readable */}
              <div className="player-seat__stack text-[11px] font-semibold leading-tight tabular-nums mt-0.5">
                {formatChips(chipCount)}
              </div>
              {actionState && (
                <div className="player-seat__state text-[9px] font-semibold uppercase tracking-wide text-emerald-200 mt-0.5">
                  {actionState}
                </div>
              )}
              {/* Tiny status badge for hero only if needed */}
              {isHero && (positionLabel === 'BTN' || isSittingOut || isActive) && (
                <div className="flex items-center gap-1 mt-1">
                  {isActive && (
                    <span className="player-seat__pulse rounded-full animate-pulse motion-reduce:animate-none" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CARDS (The Dynamic Layer) */}
        {safeCards.length > 0 && (
          <div
            className={clsx('relative pointer-events-none', layout.cardWrapper)}
            style={{ marginTop: isHero && side === 'bottom' ? `${HERO_CARD_OVERLAP_Y}px` : undefined }}
          >
            <div className={clsx('player-seat__cards-stack flex items-center justify-center gap-2', isHorizontal && 'flex-col')}>
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
                      size={isHero ? 'md' : 'sm'}
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
