/**
 * HandResultOverlay Component
 * 
 * Shows hand results at showdown with winners and hand ranks.
 */

import { useMemo } from 'react'
import { formatByCurrency, type CurrencyType } from '@/utils/currency'
import type { HandResult } from '../../types/normalized'
import MiniCard from './MiniCard'

interface HandResultOverlayProps {
  handResult: HandResult
  currency?: CurrencyType
  onClose?: () => void
}

export function HandResultOverlay({ handResult, currency = 'PLAY', onClose }: HandResultOverlayProps) {
  const { winners, showdown_hands, rake_amount, total_pot } = handResult

  const sortedWinners = useMemo(() => {
    return [...winners].sort((a, b) => b.amount - a.amount)
  }, [winners])

  return (
    <div className="hand-result-overlay fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Hand Results</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl"
            >
              ×
            </button>
          )}
        </div>

        {/* Total pot */}
        {total_pot !== undefined && (
          <div className="mb-4 text-center">
            <div className="text-sm text-gray-400">Total Pot</div>
            <div className="text-xl font-bold text-yellow-400 font-mono">
              {formatByCurrency(total_pot, currency)}
            </div>
            {rake_amount !== undefined && rake_amount > 0 && (
              <div className="text-xs text-gray-500">
                Rake: {formatByCurrency(rake_amount, currency)}
              </div>
            )}
          </div>
        )}

        {/* Winners */}
        <div className="space-y-3">
          {sortedWinners.map((winner, index) => (
            <div
              key={`${winner.user_id}-${index}`}
              className="bg-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {index === 0 && (
                    <div className="text-2xl">🏆</div>
                  )}
                  <div>
                    <div className="font-semibold text-white">
                      Player {winner.user_id}
                    </div>
                    {winner.hand_rank && (
                      <div className="text-sm text-green-400">
                        {winner.hand_rank}
                      </div>
                    )}
                    {winner.description && (
                      <div className="text-xs text-gray-400">
                        {winner.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-green-400 font-mono">
                    +{formatByCurrency(winner.amount, currency)}
                  </div>
                  {winner.rake_deducted !== undefined && winner.rake_deducted > 0 && (
                    <div className="text-xs text-gray-500">
                      (Rake: {formatByCurrency(winner.rake_deducted, currency)})
                    </div>
                  )}
                </div>
              </div>

              {/* Best hand cards */}
              {winner.best_hand_cards && winner.best_hand_cards.length > 0 && (
                <div className="mt-2 flex gap-1.5">
                  {winner.best_hand_cards.slice(0, 5).map((card, cardIndex) => {
                    const key = typeof card === 'string'
                      ? `card-${card}-${cardIndex}`
                      : `card-${card.rank ?? 'X'}${card.suit ?? 'X'}-${cardIndex}`
                    return <MiniCard key={key} card={card} size="sm" />
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Showdown hands (all players that showed) */}
        {showdown_hands && showdown_hands.length > 0 && (
          <div className="mt-6">
            <div className="text-sm text-gray-400 mb-2">All Hands</div>
            <div className="space-y-2">
              {showdown_hands.map((hand, index) => (
                <div
                  key={`${hand.user_id}-${index}`}
                  className="bg-gray-700 bg-opacity-50 rounded p-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-300 truncate">Player {hand.user_id}</span>
                    {hand.hand_rank && (
                      <span className="text-gray-400 text-xs">{hand.hand_rank}</span>
                    )}
                  </div>
                  {hand.best_hand_cards && hand.best_hand_cards.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      {hand.best_hand_cards.slice(0, 5).map((card, cardIndex) => {
                        const key = typeof card === 'string'
                          ? `card-${card}-${cardIndex}`
                          : `card-${card.rank ?? 'X'}${card.suit ?? 'X'}-${cardIndex}`
                        return <MiniCard key={key} card={card} size="sm" />
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HandResultOverlay
