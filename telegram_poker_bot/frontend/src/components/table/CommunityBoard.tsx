import { RefObject, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import PlayingCard from '@/components/ui/PlayingCard'

interface CommunityBoardProps {
  potAmount: number
  cards: string[]
  highlightedCards?: string[]
  potRef?: RefObject<HTMLDivElement>
}

export default function CommunityBoard({ potAmount, cards, highlightedCards = [], potRef }: CommunityBoardProps) {
  const { t } = useTranslation()
  const [isPulsing, setIsPulsing] = useState(false)

  const slots = useMemo(() => Array.from({ length: 5 }, (_, idx) => cards[idx]), [cards])

  useEffect(() => {
    if (Number.isNaN(potAmount)) return undefined

    setIsPulsing(true)
    const timer = window.setTimeout(() => setIsPulsing(false), 700)
    return () => window.clearTimeout(timer)
  }, [potAmount])

  const cardHeight = 'clamp(92px, 18vw, 128px)'
  const cardWidth = 'clamp(66px, 14vw, 94px)'

  return (
    <div className="flex w-full flex-col items-center gap-4" style={{ minHeight: 'clamp(180px, 26vh, 260px)' }}>
      <div
        ref={potRef}
        className={`relative flex min-w-[11rem] flex-col items-center rounded-full border border-orange-200/50 bg-orange-500/40 px-6 py-3 text-center shadow-[0_0_18px_rgba(255,140,80,0.8)] backdrop-blur-xl transition ${
          isPulsing ? 'animate-[pulse_1s_ease-in-out]' : ''
        }`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-orange-50/80">
          {t('table.potLabel', { defaultValue: 'POT' })}
        </span>
        <span className="text-2xl font-semibold leading-tight text-orange-50 drop-shadow-sm">{potAmount}</span>
      </div>

      <div className="flex w-full justify-center px-3 sm:px-6">
        <div className="flex items-start justify-center">
          {slots.map((card, index) => {
            const offset = Math.abs(2 - index)
            const spacingClass =
              index === 0 || index === 4 ? 'mx-2.5 sm:mx-3' : index === 1 || index === 3 ? 'mx-2' : 'mx-1.5'

            return (
              <div
                key={`board-card-slot-${index}`}
                className={`relative ${spacingClass}`}
                style={{ transform: `translateY(${offset * 3}px)` }}
              >
                <div
                  className="flex items-center justify-center rounded-2xl border border-white/30 bg-white/20 shadow-[0_12px_28px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                  style={{ height: cardHeight, width: cardWidth }}
                >
                  {card ? (
                    <PlayingCard card={card} size="lg" highlighted={highlightedCards.includes(card)} />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-white/70">
                      <span className="text-xl leading-none">⋯</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide">
                        {t('table.waitingForBoard', { defaultValue: 'Waiting for board...' })}
                      </span>
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
