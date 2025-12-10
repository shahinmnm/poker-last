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
}

export default function CommunityBoard({
  potAmount,
  cards,
  highlightedCards = [],
  potRef,
  currencyType = 'REAL',
}: CommunityBoardProps) {
  const { t } = useTranslation()
  const [isPulsing, setIsPulsing] = useState(false)

  const slots = useMemo(() => Array.from({ length: 5 }, (_, idx) => cards[idx]), [cards])
  useEffect(() => {
    if (!Number.isFinite(potAmount)) return undefined

    setIsPulsing(true)
    const timer = window.setTimeout(() => setIsPulsing(false), 700)
    return () => window.clearTimeout(timer)
  }, [potAmount])

  const cardHeight = 'clamp(50px, 10vw, 76px)'
  const cardWidth = 'clamp(36px, 7.6vw, 54px)'
  const safePotAmount = Number.isFinite(potAmount) ? potAmount : 0
  const displayPot = formatByCurrency(safePotAmount, currencyType, { withDecimals: currencyType === 'REAL' })

  return (
    <div className="flex w-full flex-col items-center gap-2.5" style={{ minHeight: 'clamp(120px, 18vh, 190px)' }}>
      <div
        ref={potRef}
        className={`table-pot-container ${isPulsing ? 'animate-[pulse_1s_ease-in-out]' : ''}`}
        style={{ transform: 'scale(0.9)', transformOrigin: 'center center' }}
      >
        <div className="table-pot-pill">
          <span className="table-pot-pill-label">
            {t('table.potLabel', { defaultValue: 'POT' })}
          </span>
          <div className="table-pot-pill-amount">{displayPot}</div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-2 sm:px-4">
        <div className="flex items-center justify-center gap-1">
          {slots.map((card, index) => {
            const offset = Math.abs(2 - index)

            return (
              <div
                key={`board-card-slot-${index}`}
                className="relative"
                style={{ transform: `translateY(${offset * 2}px)` }}
              >
                <div
                  className="flex items-center justify-center rounded-lg border border-white/20 bg-white/10 shadow-[0_10px_22px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                  style={{ height: cardHeight, width: cardWidth }}
                >
                  {card ? (
                    <PlayingCard card={card} size="md" highlighted={highlightedCards.includes(card)} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
