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
  const placeholderLabels = useMemo(
    () => [
      t('table.boardPlaceholders.preflop1', { defaultValue: 'PREFLOP 1' }),
      t('table.boardPlaceholders.preflop2', { defaultValue: 'PREFLOP 2' }),
      t('table.boardPlaceholders.preflop3', { defaultValue: 'PREFLOP 3' }),
      t('table.boardPlaceholders.turn', { defaultValue: 'TURN' }),
      t('table.boardPlaceholders.river', { defaultValue: 'RIVER' }),
    ],
    [t],
  )

  useEffect(() => {
    if (Number.isNaN(potAmount)) return undefined

    setIsPulsing(true)
    const timer = window.setTimeout(() => setIsPulsing(false), 700)
    return () => window.clearTimeout(timer)
  }, [potAmount])

  const cardHeight = 'clamp(58px, 12vw, 88px)'
  const cardWidth = 'clamp(42px, 8.6vw, 60px)'

  return (
    <div className="flex w-full flex-col items-center gap-3" style={{ minHeight: 'clamp(140px, 21vh, 210px)' }}>
      <div
        ref={potRef}
        className={`relative flex min-w-[7.5rem] max-w-[30vw] flex-col items-center gap-1 rounded-full border border-amber-100/30 bg-gradient-to-br from-amber-300/80 via-amber-200/80 to-amber-400/80 px-3 py-2 text-center shadow-[0_12px_38px_rgba(249,168,38,0.4)] backdrop-blur-xl transition ${
          isPulsing ? 'animate-[pulse_1s_ease-in-out]' : ''
        }`}
      >
        <div className="pointer-events-none absolute inset-[-6px] rounded-full border border-amber-200/40 shadow-[0_10px_30px_rgba(0,0,0,0.35)]" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.3em] text-amber-950/70">
          {t('table.potLabel', { defaultValue: 'POT' })}
        </span>
        <span className="text-lg font-semibold leading-tight text-amber-50 drop-shadow-sm sm:text-xl">{potAmount}</span>
      </div>

      <div className="flex w-full justify-center px-2 sm:px-4">
        <div className="flex items-start justify-center">
          {slots.map((card, index) => {
            const offset = Math.abs(2 - index)
            const spacingClass = index === 0 || index === 4 ? 'mx-2 sm:mx-3' : index === 1 || index === 3 ? 'mx-1.5 sm:mx-2' : 'mx-1.5'

            return (
              <div
                key={`board-card-slot-${index}`}
                className={`relative ${spacingClass}`}
                style={{ transform: `translateY(${offset * 2}px)` }}
              >
                <div
                  className="flex items-center justify-center rounded-md border border-white/20 bg-white/10 shadow-[0_10px_22px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                  style={{ height: cardHeight, width: cardWidth }}
                >
                  {card ? (
                    <PlayingCard card={card} size="md" highlighted={highlightedCards.includes(card)} />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-white/70">
                      <span className="text-base leading-none">⋯</span>
                      <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em]">
                        {placeholderLabels[index]}
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
