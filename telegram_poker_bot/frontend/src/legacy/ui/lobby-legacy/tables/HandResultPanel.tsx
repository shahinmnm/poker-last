import { useEffect, useMemo, useState } from 'react'
import type { TableState } from '@/types/game'
import { formatCurrency } from '../../../../utils/currency'
import MiniCard from '@/components/ui/MiniCard'

const RESULT_FADE_MS = 2200
const RESULT_HIDE_MS = 2600

interface HandResultPanelProps {
  liveState: TableState
  currentUserId: number | string | null
}

const HAND_RANK_LABEL: Record<string, string> = {
  high_card: 'High Card',
  pair: 'One Pair',
  two_pair: 'Two Pair',
  three_of_a_kind: 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
  full_house: 'Full House',
  four_of_a_kind: 'Four of a Kind',
  straight_flush: 'Straight Flush',
  royal_flush: 'Royal Flush',
}

const SUIT_SYMBOLS: Record<string, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
}

function formatCard(card: string): string {
  if (!card || card.length < 2) return card
  const rank = card[0].toUpperCase() === 'T' ? '10' : card[0].toUpperCase()
  const suit = SUIT_SYMBOLS[card[1].toLowerCase()] || card[1]
  return `${rank}${suit}`
}

export default function HandResultPanel({ liveState, currentUserId }: HandResultPanelProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [isFading, setIsFading] = useState(false)

  const result = useMemo(() => {
    if (!liveState.hand_result || !liveState.hand_result.winners || liveState.hand_result.winners.length === 0) {
      return null
    }

    const winners = liveState.hand_result.winners
    const currentUserWinner = winners.find((w) => w.user_id?.toString() === currentUserId?.toString())
    const rakeAmount = liveState.hand_result.rake_amount || 0
    const totalPot = liveState.hand_result.total_pot || liveState.pot
    
    // Group winners by pot_index
    const winnersByPot = winners.reduce((acc, winner) => {
      const potIndex = winner.pot_index ?? 0
      if (!acc[potIndex]) {
        acc[potIndex] = []
      }
      acc[potIndex].push(winner)
      return acc
    }, {} as Record<number, typeof winners>)

    const potIndices = Object.keys(winnersByPot).map(Number).sort()
    const hasSidePots = potIndices.length > 1
    
    return {
      winners,
      currentUserWinner,
      winnersByPot,
      potIndices,
      hasSidePots,
      isCurrentUserWinner: !!currentUserWinner,
      rakeAmount,
      totalPot,
    }
  }, [liveState, currentUserId])

  useEffect(() => {
    if (!result) return

    setIsVisible(true)
    setIsFading(false)
    const fadeTimer = window.setTimeout(() => setIsFading(true), RESULT_FADE_MS)
    const hideTimer = window.setTimeout(() => setIsVisible(false), RESULT_HIDE_MS)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(hideTimer)
    }
  }, [result, liveState.hand_id])

  if (!result || !isVisible) {
    return null
  }

  const { winnersByPot, potIndices, hasSidePots, isCurrentUserWinner, rakeAmount, totalPot } = result

  return (
    <div className={`my-2 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[3%] p-3 backdrop-blur-sm transition-opacity duration-300 ${isFading ? 'opacity-0' : 'opacity-100'}`}>
      {/* Pot and Rake Summary */}
      {totalPot > 0 && (
        <div className="mb-2 pb-2 border-b border-white/10">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[color:var(--text-muted)]">Total Pot:</span>
            <span className="font-semibold text-sky-300">{formatCurrency(totalPot)}</span>
          </div>
          {rakeAmount > 0 && (
            <div className="flex items-center justify-between text-[10px] mt-1">
              <span className="text-rose-400/70">Rake (5%):</span>
              <span className="font-medium text-rose-400/70">-{formatCurrency(rakeAmount)}</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {potIndices.map((potIndex) => {
          const potWinners = winnersByPot[potIndex]
          if (!potWinners || potWinners.length === 0) return null

          const mainWinner = potWinners[0]
          const winnerPlayer = liveState.players.find(
            (p) => p.user_id?.toString() === mainWinner.user_id?.toString(),
          )
          const winnerName = winnerPlayer?.display_name || `Player ${mainWinner.user_id}`
          const handRankLabel =
            (mainWinner.hand_rank && (HAND_RANK_LABEL[mainWinner.hand_rank] || mainWinner.hand_rank.replace(/_/g, ' '))) ||
            'Winning Hand'
          const bestCards = mainWinner.best_hand_cards || []
          const formattedCards = bestCards.map(formatCard).join(' ')
          const isUserWinner = potWinners.some((w) => w.user_id?.toString() === currentUserId?.toString())

          return (
            <div key={potIndex} className={potIndex > 0 ? 'pt-2 border-t border-white/10' : ''}>
              {hasSidePots && (
                <p className="text-[9px] uppercase tracking-wide text-[color:var(--text-muted)] mb-1">
                  {potIndex === 0 ? 'Main Pot' : `Side Pot #${potIndex}`}
                </p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[13px] font-bold ${isUserWinner ? 'text-emerald-400' : 'text-[color:var(--text-primary)]'}`}>
                    {isUserWinner ? '🎉 You Won!' : `Winner: ${winnerName}`}
                  </span>
                  {isUserWinner && (
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
                      YOU
                    </span>
                  )}
                </div>
                <span className={`text-[13px] font-bold ${isUserWinner || mainWinner.amount > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {potWinners.length > 1 ? 'Split' : mainWinner.amount === 0 ? 'Split Pot' : `+${formatCurrency(mainWinner.amount)}`}
                </span>
              </div>
              
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-semibold text-sky-300">{handRankLabel}</span>
                {bestCards.length > 0 && (
                  <div className="flex items-center gap-1" aria-label={formattedCards}>
                    {bestCards.slice(0, 5).map((card) => (
                      <MiniCard key={`${mainWinner.user_id}-${card}`} card={card} size="sm" />
                    ))}
                  </div>
                )}
              </div>

              {potWinners.length > 1 && (
                <div className="text-[10px] text-amber-400/80 mt-1">
                  Split with {potWinners.length - 1} other{potWinners.length > 2 ? 's' : ''}
                </div>
              )}
            </div>
          )
        })}

        {!isCurrentUserWinner && currentUserId && (
          <div className="text-[10px] text-rose-400/80 pt-1">You lost this hand</div>
        )}
      </div>
    </div>
  )
}
