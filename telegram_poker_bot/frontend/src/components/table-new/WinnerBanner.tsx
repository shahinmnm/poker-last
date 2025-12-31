/**
 * WinnerBanner Component
 * 
 * Animated banner showing the winner(s) after a hand.
 * Uses safe zone positioning to avoid overlapping board/player areas.
 * Anchored to board area with surface tokens for "board event" feel.
 */

import { useEffect, useState } from 'react'
import { formatByCurrency, type CurrencyType } from '@/utils/currency'
import type { WinnerInfo } from '../../types/normalized'
import { Trophy } from 'lucide-react'
import MiniCard from './MiniCard'

interface WinnerBannerProps {
  winners: WinnerInfo[]
  currency?: CurrencyType
  duration?: number // ms
  onComplete?: () => void
}

export function WinnerBanner({
  winners,
  currency = 'PLAY',
  duration = 5000,
  onComplete,
}: WinnerBannerProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onComplete?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onComplete])

  if (!isVisible || winners.length === 0) return null

  const mainWinner = winners[0]
  const isMultipleWinners = winners.length > 1

  return (
    <div className="winner-banner-safe">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex items-center justify-center gap-2">
          {/* Trophy icon - respects motion-reduce via CSS */}
          <Trophy size={20} className="text-amber-400 flex-shrink-0" />
          <div className="text-center">
            <div className="winner-banner-safe__amount">
              {isMultipleWinners ? (
                <>
                  {formatByCurrency(
                    winners.reduce((sum, w) => sum + w.amount, 0),
                    currency
                  )}
                </>
              ) : (
                formatByCurrency(mainWinner.amount, currency)
              )}
            </div>
            <div className="winner-banner-safe__label">
              {isMultipleWinners 
                ? `Split ${winners.length}`
                : mainWinner.hand_rank 
                  ? mainWinner.hand_rank
                  : 'Winner'
              }
            </div>
          </div>
          <Trophy size={20} className="text-amber-400 flex-shrink-0" />
        </div>
        {mainWinner.best_hand_cards && mainWinner.best_hand_cards.length > 0 && (
          <div className="flex items-center justify-center gap-1.5">
            {mainWinner.best_hand_cards.slice(0, 5).map((card, index) => {
              const cardKey = typeof card === 'string'
                ? `card-${card}-${index}`
                : `card-${card.rank ?? 'X'}${card.suit ?? 'X'}-${index}`
              return <MiniCard key={cardKey} card={card} size="sm" />
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default WinnerBanner
