/**
 * WinnerBanner Component
 * 
 * Animated banner showing the winner(s) after a hand.
 * Uses safe zone positioning to avoid overlapping board/player areas.
 */

import { useEffect, useState } from 'react'
import { formatByCurrency, type CurrencyType } from '@/utils/currency'
import type { WinnerInfo } from '../../types/normalized'

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
      <div className="flex items-center justify-center gap-3">
        <div className="text-2xl animate-bounce">🎉</div>
        <div className="text-center">
          <div className="winner-banner-safe__amount">
            {isMultipleWinners ? (
              <>
                {winners.length} players split{' '}
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
              ? 'Split Pot' 
              : mainWinner.hand_rank 
                ? `Won with ${mainWinner.hand_rank}`
                : 'Winner!'
            }
          </div>
        </div>
        <div className="text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>
          🎊
        </div>
      </div>
    </div>
  )
}

export default WinnerBanner
