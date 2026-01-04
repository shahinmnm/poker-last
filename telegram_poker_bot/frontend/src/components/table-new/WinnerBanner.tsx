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

const WINNER_BANNER_DURATION_MS = 2600
const WINNER_BANNER_FADE_LEAD_MS = 500

interface WinnerBannerProps {
  winners: WinnerInfo[]
  currency?: CurrencyType
  duration?: number // ms
  onComplete?: () => void
  playerNames?: Record<string, string>
}

export function WinnerBanner({
  winners,
  currency = 'PLAY',
  duration = WINNER_BANNER_DURATION_MS,
  onComplete,
  playerNames = {},
}: WinnerBannerProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)

  useEffect(() => {
    const fadeAfter = Math.max(0, duration - WINNER_BANNER_FADE_LEAD_MS)
    const fadeTimer = setTimeout(() => {
      setIsFading(true)
    }, fadeAfter)

    const timer = setTimeout(() => {
      setIsVisible(false)
      onComplete?.()
    }, duration)

    return () => {
      clearTimeout(timer)
      clearTimeout(fadeTimer)
    }
  }, [duration, onComplete])

  if (!isVisible || winners.length === 0) return null

  const mainWinner = winners[0]
  const isMultipleWinners = winners.length > 1
  const mainWinnerName =
    (mainWinner.user_id !== undefined && playerNames[String(mainWinner.user_id)]) ||
    (mainWinner.user_id !== undefined ? `Player ${mainWinner.user_id}` : 'Winner')

  return (
    <div className={`winner-banner-safe transition-opacity duration-400 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col items-center justify-center gap-2 px-3 py-1.5 text-center">
        <div className="flex items-center justify-center gap-2">
          <Trophy size={18} className="text-amber-400 flex-shrink-0" />
          <div>
            <div className="winner-banner-safe__amount">
              {formatByCurrency(mainWinner.amount, currency)}
            </div>
            <div className="winner-banner-safe__label" title={mainWinnerName} dir="auto">
              {mainWinnerName}
              {isMultipleWinners ? ` · Split ${winners.length}` : ''}
            </div>
          </div>
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
