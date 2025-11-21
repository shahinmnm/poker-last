import { useMemo } from 'react'

interface HandWinnerResult {
  user_id: number
  amount: number
  pot_index: number
  hand_score: number
  hand_rank: string
  best_hand_cards: string[]
}

interface LivePlayerState {
  user_id: number
  seat: number
  stack: number
  bet: number
  in_hand: boolean
  is_button: boolean
  is_small_blind: boolean
  is_big_blind: boolean
  acted?: boolean
  display_name?: string | null
}

interface LiveTableState {
  type: 'table_state'
  table_id: number
  hand_id: number | null
  status: string
  street: string | null
  board: string[]
  pot: number
  current_bet: number
  min_raise: number
  current_actor: number | null
  action_deadline?: string | null
  players: LivePlayerState[]
  hero: { user_id: number; cards: string[] } | null
  last_action?: Record<string, unknown> | null
  hand_result?: { winners: HandWinnerResult[] } | null
}

interface HandResultPanelProps {
  liveState: LiveTableState
  currentUserId: number | null
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
  const result = useMemo(() => {
    if (!liveState.hand_result || !liveState.hand_result.winners || liveState.hand_result.winners.length === 0) {
      return null
    }

    const winners = liveState.hand_result.winners
    const currentUserWinner = winners.find((w) => w.user_id === currentUserId)
    
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
    }
  }, [liveState, currentUserId])

  if (!result) {
    return null
  }

  const { winnersByPot, potIndices, hasSidePots, isCurrentUserWinner } = result

  return (
    <div className="my-2 rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[3%] p-3 backdrop-blur-sm">
      <div className="space-y-2">
        {potIndices.map((potIndex) => {
          const potWinners = winnersByPot[potIndex]
          if (!potWinners || potWinners.length === 0) return null

          const mainWinner = potWinners[0]
          const winnerPlayer = liveState.players.find((p) => p.user_id === mainWinner.user_id)
          const winnerName = winnerPlayer?.display_name || `Player ${mainWinner.user_id}`
          const handRankLabel = HAND_RANK_LABEL[mainWinner.hand_rank] || mainWinner.hand_rank.replace(/_/g, ' ')
          const bestCards = mainWinner.best_hand_cards || []
          const formattedCards = bestCards.map(formatCard).join(' ')
          const isUserWinner = potWinners.some(w => w.user_id === currentUserId)

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
                  {potWinners.length > 1 ? 'Split' : mainWinner.amount === 0 ? 'Split Pot' : `+${mainWinner.amount}`}
                </span>
              </div>
              
              <div className="text-[11px] mt-1">
                <span className="font-semibold text-sky-300">{handRankLabel}</span>
                {formattedCards && (
                  <span className="ml-2 text-[color:var(--text-muted)]">({formattedCards})</span>
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
