import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

interface CommunityCardsProps {
  cards: string[]
  highlightedCards?: string[]
}

const suitSymbol: Record<string, string> = {
  h: '♥',
  d: '♦',
  s: '♠',
  c: '♣',
}

const rankMap: Record<string, string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  T: '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
}

export default function CommunityCards({ cards, highlightedCards = [] }: CommunityCardsProps) {
  const { t } = useTranslation()
  const slots = useMemo(() => Array.from({ length: 5 }, (_, idx) => cards[idx]), [cards])

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-black/30 px-4 py-3 backdrop-blur-sm">
      {slots.map((card, index) => {
        if (!card) {
          return (
            <div
              key={`card-slot-${index}`}
              className="flex h-16 w-12 items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/5 text-[10px] uppercase tracking-wide text-white/50 shadow-inner"
            >
              {t('table.waitingForBoard')}
            </div>
          )
        }

        const rank = rankMap[card[0].toUpperCase()] ?? card[0]
        const suit = suitSymbol[card[1].toLowerCase()] ?? card[1]
        const isRed = card[1].toLowerCase() === 'h' || card[1].toLowerCase() === 'd'
        const isHighlighted = highlightedCards.includes(card)

        return (
          <div
            key={`card-${card}-${index}`}
            className={`flex h-16 w-12 flex-col items-center justify-center rounded-lg border bg-white text-sm font-semibold shadow-md transition ${
              isHighlighted ? 'border-emerald-400 shadow-emerald-400/30' : 'border-gray-200'
            }`}
            style={{ boxShadow: isHighlighted ? '0 0 14px rgba(0, 201, 141, 0.45)' : undefined }}
          >
            <span className={`leading-none ${isRed ? 'text-[#E53935]' : 'text-[#212121]'}`}>{rank}</span>
            <span className={`leading-none text-lg ${isRed ? 'text-[#E53935]' : 'text-[#212121]'}`}>{suit}</span>
          </div>
        )
      })}
    </div>
  )
}
