/**
 * Phase 5: CommunityBoard Component
 * 
 * Renders community cards from normalized state.
 * Supports:
 * - Standard community cards (Hold'em, Omaha)
 * - Face-up vs face-down cards (Stud games)
 * - Discard phase UI (Draw games)
 */

import type { Card } from '../../types/normalized'
import CardRenderer from './CardRenderer'

interface CommunityBoardProps {
  communityCards: Card[]
  street?: string | null
  className?: string
}

export function CommunityBoard({
  communityCards,
  street,
  className = '',
}: CommunityBoardProps) {
  if (!communityCards || communityCards.length === 0) {
    return null
  }

  const streetLabel = street ? ` - ${street.charAt(0).toUpperCase() + street.slice(1)}` : ''

  return (
    <div className={`community-board ${className}`}>
      <div className="flex flex-col items-center gap-2">
        {streetLabel && (
          <div className="text-sm font-semibold text-gray-400">
            {streetLabel}
          </div>
        )}
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
