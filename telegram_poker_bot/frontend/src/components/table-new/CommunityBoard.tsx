/**
 * Phase 5: CommunityBoard Component
 * 
 * Renders community cards from normalized state.
 * Modern, minimalist design - empty felt when no cards (no dotted outlines).
 * Supports:
 * - Standard community cards (Hold'em, Omaha)
 * - Face-up vs face-down cards (Stud games)
 * - Discard phase UI (Draw games)
 */

import type { Card } from '../../types/normalized'
import CardRenderer from './CardRenderer'
import { getCommunityCardSize } from '@/utils/communityCardSizing'

interface CommunityBoardProps {
  communityCards: Card[]
  street?: string | null // Kept for API compatibility
  className?: string
}

export function CommunityBoard({
  communityCards,
  // street prop kept for API compatibility but not displayed
  className = '',
}: CommunityBoardProps) {
  const totalCards = communityCards?.length ?? 0
  const centerIndex = (totalCards - 1) / 2

  // Don't render anything if no community cards - show empty felt
  if (!communityCards || totalCards === 0) {
    return null
  }

  return (
    <div className={`community-board ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <div className="relative flex flex-nowrap items-end justify-center" style={{ minHeight: 'clamp(74px, 14vw, 108px)' }}>
          {communityCards.map((card, index) => {
            const size = getCommunityCardSize(index, totalCards)
            const depth = totalCards - Math.abs(index - centerIndex)
            const stackOffset = Math.abs(index - centerIndex) * 2
            return (
              <div
                key={index}
                className={`relative ${index > 0 ? '-ml-4 sm:-ml-5' : ''} transition-transform duration-200`}
                style={{
                  zIndex: 10 + depth,
                  transform: `translateY(${stackOffset}px)`,
                }}
              >
                <CardRenderer card={card} size={size} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CommunityBoard
