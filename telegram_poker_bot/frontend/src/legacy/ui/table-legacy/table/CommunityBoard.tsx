import { RefObject, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import PlayingCard from '@/components/ui/PlayingCard'
import { CurrencyType, formatByCurrency } from '@/utils/currency'

interface CommunityBoardProps {
  potAmount: number
  cards: string[]
  highlightedCards?: string[]
  potRef?: RefObject<HTMLDivElement>
  currencyType?: CurrencyType
  opponentTag?: string | null
  showPotInBoard?: boolean
}

export default function CommunityBoard({
  potAmount,
  cards,
  highlightedCards = [],
  potRef,
  currencyType = 'REAL',
  opponentTag = null,
  showPotInBoard = true,
}: CommunityBoardProps) {
  const { t } = useTranslation()
  const [isPulsing, setIsPulsing] = useState(false)

  const dealtCards = useMemo(() => cards.slice(0, 5).filter(Boolean), [cards])
  useEffect(() => {
    if (!Number.isFinite(potAmount)) return undefined

    setIsPulsing(true)
    const timer = window.setTimeout(() => setIsPulsing(false), 700)
    return () => window.clearTimeout(timer)
  }, [potAmount])

  const cardHeight = 'clamp(56px, 12vw, 84px)'
  const cardWidth = 'clamp(40px, 9vw, 60px)'
  const safePotAmount = Number.isFinite(potAmount) ? potAmount : 0
  const displayPot = formatByCurrency(safePotAmount, currencyType, { withDecimals: currencyType === 'REAL' })

  return (
    // PHASE 3: Board cluster container - semantic wrapper for pot + cards
    // Uses CSS gap from --board-cluster-gap variable (set by data-ui-mode)
    // Order: pot (0) -> cards (1) -> winner banner passed via parent
    <div className="board-cluster board-cluster--expanded" style={{ minHeight: 'clamp(120px, 18vh, 190px)' }}>
      {opponentTag && (
        <div className="top-hud top-hud--board">
          <div className="top-hud__lane top-hud__lane--opponent">
            <div className="top-hud__pill" dir="auto" title={opponentTag}>
              <span className="top-hud__pill-text">{opponentTag}</span>
            </div>
          </div>
        </div>
      )}

      {/* Pot display - board anchored above community cards */}
      {showPotInBoard && (
        <div
          ref={potRef}
          className={`board-cluster__pot board-pot-anchor pointer-events-none motion-reduce:animate-none ${isPulsing ? 'animate-[pulse_1s_ease-in-out]' : ''}`}
        >
          <div className="table-pot-pill" title={displayPot}>
            <span className="table-pot-pill-label">
              {t('table.potLabel', { defaultValue: 'POT' })}:
            </span>
            {/* BETA HARDENING: tabular-nums prevents layout shift when pot changes */}
            <div className="table-pot-pill-amount">{displayPot}</div>
          </div>
        </div>
      )}

      {/* PHASE 3: Community cards - order: 1 (sacred zone, never overlapped) */}
      <div className="board-cluster__cards flex w-full items-center justify-center px-2 sm:px-4 community-cards-sacred">
        <div className="flex items-center justify-center gap-2 sm:gap-3" style={{ minHeight: cardHeight }}>
          {dealtCards.map((card, index) => (
            <div
              key={`board-card-slot-${index}`}
              className="flex items-center justify-center"
              style={{ height: cardHeight, width: cardWidth }}
            >
              <PlayingCard card={card} size="md" highlighted={highlightedCards.includes(card)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
