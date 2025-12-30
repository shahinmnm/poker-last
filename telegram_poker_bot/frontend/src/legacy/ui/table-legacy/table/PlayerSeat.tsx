import { forwardRef, useMemo, useCallback } from 'react'
import clsx from 'clsx'
import { Plus } from 'lucide-react'
import PlayerCircularTimer from './PlayerCircularTimer'
import PlayingCard from '../../../../components/ui/PlayingCard'
import HeroDetailPopover from '../../../../components/table/HeroDetailPopover'
import useAutoDismissOverlay from '../../../../hooks/useAutoDismissOverlay'
import { formatChips } from '../../../../utils/formatChips'

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
  /** PHASE 5: Whether hero seat should be in reduced scale mode (showdown/opponent turn) */
  heroScaleReduced?: boolean
  /** Seat index (0-based) for hero detail popover */
  seatIndex?: number
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
      heroScaleReduced = false,
      seatIndex = 0,
    },
    ref,
  ) => {
    // Phase 2: Hero detail popover state
    const { 
      isOpen: showHeroDetail, 
      open: openHeroDetail, 
      close: closeHeroDetail,
      overlayRef: heroOverlayRef 
    } = useAutoDismissOverlay({ 
      timeoutMs: 2500 
    })
    
    // Handle hero seat tap
    const handleHeroTap = useCallback(() => {
      if (isHero && !isEmpty) {
        openHeroDetail()
      }
    }, [isHero, isEmpty, openHeroDetail])
    
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

    // PHASE 5: Compute hero seat scale class based on UI mode
    // - Hero with full scale (isMyTurn): 'player-seat--hero-action'
    // - Hero with reduced scale (not isMyTurn): 'player-seat--hero-reduced'
    // - Non-hero: no additional class
    const getHeroScaleClass = (): string => {
      if (!isHero) return ''
      return heroScaleReduced ? 'player-seat--hero-reduced' : 'player-seat--hero-action'
    }
    const heroScaleClass = getHeroScaleClass()

    return (
      <div
        ref={ref}
        className={clsx(
          'relative flex items-center transition-all duration-300 m-1 player-seat',
          layout.container,
          mutedState && 'grayscale opacity-50',
          heroScaleClass,
          className,
        )}
        style={{
          // Use clamp() for responsive sizing that adapts to viewport
          // --seat-scale-factor is set via CSS media queries in table-layout.css
          // Min values raised to ensure readability on small screens (min 64px effective)
          width: isHorizontal 
            ? `calc(clamp(80px, 12vw, 110px) * var(--seat-scale-factor, 1))` 
            : `calc(clamp(72px, 10vw, 95px) * var(--seat-scale-factor, 1))`,
          height: isHorizontal 
            ? `calc(clamp(72px, 10vw, 95px) * var(--seat-scale-factor, 1))` 
            : `calc(clamp(85px, 12vw, 115px) * var(--seat-scale-factor, 1))`,
          zIndex: isActive ? 30 : 20,
        }}
        aria-label={seatLabel}
      >
        {/* AVATAR (The Centerpiece) */}
        <div className="relative z-20 flex items-center justify-center">
          <div className="relative flex items-center justify-center" style={{ width: 'clamp(38px, 6vw, 52px)', height: 'clamp(38px, 6vw, 52px)' }}>
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
                'relative flex items-center justify-center rounded-full text-sm font-bold text-white shadow-xl',
                /* Premium surface with subtle gradient */
                'bg-gradient-to-b from-slate-800/95 to-slate-900/95',
                /* Default state ring */
                'ring-2 ring-[var(--border-2)]',
                /* Active player glow */
                isActive && 'ring-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.4)]',
                /* Hero highlight */
                isHero && !isActive && 'ring-amber-300/80 shadow-amber-500/20',
              )}
              style={{ width: 'clamp(40px, 6vw, 52px)', height: 'clamp(40px, 6vw, 52px)' }}
            >
              <span className="text-[var(--text-1)]">{initial}</span>

              {isAllIn && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-lg shadow-rose-500/30 z-20 border border-rose-400/50">
                  ALL-IN
                </span>
              )}
            </div>

            {/* Dealer/Blind Badge (Dynamic Position) */}
            {positionLabel === 'BTN' && (
              <span className={clsx('absolute z-30 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[8px] font-black text-slate-900 shadow-md', layout.badge)}>
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

          {/* INFO PILL (Floating Badge) - Phase 2: Simplified for hero, tappable for details */}
          {/* For hero: show truncated name + stack, tap reveals full details */}
          {/* For opponents: show full info as before */}
          <div
            className={clsx(
              'absolute z-30 flex -translate-x-1/2 items-center justify-center',
              layout.infoPill,
              isHero ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
            )}
            onClick={isHero ? handleHeroTap : undefined}
            role={isHero ? 'button' : undefined}
            tabIndex={isHero ? 0 : undefined}
            onKeyDown={isHero ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleHeroTap()
              }
            } : undefined}
            aria-label={isHero ? 'Tap for player details' : undefined}
          >
            <div className={clsx(
              'flex flex-col items-center rounded-xl border border-[var(--border-2)] bg-[var(--surface-1)] px-3 py-1.5 shadow-lg shadow-black/40 backdrop-blur-md',
              isHero && 'ui-pressable hover:bg-[var(--surface-2)]'
            )}>
              {/* Player name - primary text, truncated for hero */}
              <div 
                className="text-[11px] font-bold text-[var(--text-1)] leading-tight overflow-hidden text-ellipsis whitespace-nowrap tracking-tight"
                style={{ maxWidth: isHero ? 'clamp(48px, 8vw, 64px)' : 'clamp(56px, 10vw, 76px)' }}
                dir="auto"
                title={playerName || seatLabel}
              >
                {playerName || seatLabel}
              </div>
              {/* Stack - secondary text, muted but readable */}
              <div className="text-[11px] font-semibold text-emerald-400 leading-tight tabular-nums mt-0.5">
                {formatChips(chipCount)}
              </div>
              {/* Tiny status badge for hero only if needed */}
              {isHero && (positionLabel === 'BTN' || isSittingOut || isActive) && (
                <div className="flex items-center gap-1 mt-1">
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Hero Detail Popover - Phase 2: Shows on tap, auto-dismisses */}
          {isHero && showHeroDetail && (
            <div ref={heroOverlayRef as React.RefObject<HTMLDivElement>}>
              <HeroDetailPopover
                displayName={playerName}
                stack={chipCount}
                seatIndex={seatIndex}
                isDealer={positionLabel === 'BTN'}
                isSmallBlind={positionLabel === 'SB'}
                isBigBlind={positionLabel === 'BB'}
                isSittingOut={isSittingOut}
                onClose={closeHeroDetail}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2"
              />
            </div>
          )}
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
