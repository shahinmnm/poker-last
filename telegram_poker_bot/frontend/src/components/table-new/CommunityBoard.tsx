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
  // Don't render anything if no community cards - show empty felt
  if (!communityCards || communityCards.length === 0) {
    return null
  }

  return (
    <div className={`community-board ${className}`}>
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2 flex-wrap justify-center">
          {communityCards.map((card, index) => (
            <CardRenderer key={index} card={card} size="md" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default CommunityBoard
