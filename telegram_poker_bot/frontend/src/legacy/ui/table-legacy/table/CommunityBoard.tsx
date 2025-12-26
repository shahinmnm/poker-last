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
    <div className="flex w-full flex-col items-center gap-3" style={{ minHeight: 'clamp(120px, 18vh, 190px)' }}>
      <div
        ref={potRef}
        className={`pointer-events-none ${isPulsing ? 'animate-[pulse_1s_ease-in-out]' : ''}`}
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/50 bg-gradient-to-b from-orange-400 to-orange-600 px-4 py-1 shadow-lg shadow-orange-900/40 backdrop-blur-md">
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/90">
            {t('table.potLabel', { defaultValue: 'POT' })}:
          </span>
          <div className="text-sm font-bold tracking-wide text-white">{displayPot}</div>
        </div>
      </div>

      <div className="flex w-full items-center justify-center px-2 sm:px-4">
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
