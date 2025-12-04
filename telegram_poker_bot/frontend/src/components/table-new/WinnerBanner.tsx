/**
 * WinnerBanner Component
 * 
 * Animated banner showing the winner(s) after a hand.
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
    <div className="winner-banner fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
      <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg px-8 py-4 shadow-2xl border-2 border-yellow-300">
        <div className="flex items-center gap-4">
          <div className="text-4xl animate-bounce">🎉</div>
          <div>
            <div className="text-lg font-bold text-white">
              {isMultipleWinners ? 'Winners!' : 'Winner!'}
            </div>
            <div className="text-xl font-bold text-gray-900">
              {isMultipleWinners ? (
                <>
                  {winners.length} players split{' '}
                  {formatByCurrency(
                    winners.reduce((sum, w) => sum + w.amount, 0),
                    currency
                  )}
                </>
              ) : (
                <>
                  {mainWinner.hand_rank && (
                    <span className="text-sm text-gray-700 mr-2">
                      {mainWinner.hand_rank}
                    </span>
                  )}
                  {formatByCurrency(mainWinner.amount, currency)}
                </>
              )}
            </div>
          </div>
          <div className="text-4xl animate-bounce" style={{ animationDelay: '0.2s' }}>
            🎊
          </div>
        </div>
      </div>
    </div>
  )
}

export default WinnerBanner
