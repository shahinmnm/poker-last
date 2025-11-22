/**
 * CommunityBoard - Center board showing community cards and pot
 * 
 * Features:
 * - 5 card slots for community cards (flop, turn, river)
 * - Pot display pill above cards
 * - Handles empty states
 */

import PlayingCard from '../ui/PlayingCard'

export interface CommunityBoardProps {
  /** Community cards on the board */
  board: string[]
  /** Total pot amount */
  pot: number
  /** Winning cards to highlight (optional) */
  winningCards?: string[]
}

export default function CommunityBoard({ board, pot, winningCards = [] }: CommunityBoardProps) {
  // Create 5 slots for cards
  const cardSlots = Array.from({ length: 5 }, (_, i) => board[i] || null)

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Pot Display */}
      <div className="rounded-full bg-black/70 backdrop-blur-sm px-4 py-2 border border-emerald-500/50 shadow-lg shadow-emerald-500/20">
        <div className="text-center">
          <div className="text-emerald-400 text-xs font-medium uppercase tracking-wider">
            POT
          </div>
          <div className="text-white text-lg font-bold">{pot}</div>
        </div>
      </div>

      {/* Community Cards */}
      <div className="flex gap-2 items-center justify-center">
        {cardSlots.map((card, idx) => (
          <div key={`board-slot-${idx}`}>
            {card ? (
              <PlayingCard
                card={card}
                size="md"
                highlighted={winningCards.includes(card)}
              />
            ) : (
              <div className="w-10 h-14 rounded-lg border-2 border-dashed border-white/20 bg-black/20 flex items-center justify-center">
                <span className="text-white/30 text-xs">?</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
