/**
 * Phase 5: StudRenderer Component
 * 
 * Specialized renderer for Stud poker variants.
 * Separates face-up and face-down cards.
 */

import type { Card } from '../../types/normalized'
import CardRenderer from './CardRenderer'

interface StudRendererProps {
  faceUpCards: Card[]
  faceDownCards: Card[]
  className?: string
}

export function StudRenderer({
  faceUpCards,
  faceDownCards,
  className = '',
}: StudRendererProps) {
  const hasCards = faceUpCards.length > 0 || faceDownCards.length > 0

  if (!hasCards) {
    return null
  }

  return (
    <div className={`stud-renderer ${className}`}>
      <div className="flex flex-col gap-2">
        {/* Face-down cards (always hidden for opponents) */}
        {faceDownCards.length > 0 && (
          <div className="face-down-cards flex gap-1">
            {faceDownCards.map((card, index) => (
              <CardRenderer key={`down-${index}`} card={card} size="sm" />
            ))}
          </div>
        )}
        
        {/* Face-up cards (visible to all) */}
        {faceUpCards.length > 0 && (
          <div className="face-up-cards flex gap-1">
            {faceUpCards.map((card, index) => (
              <CardRenderer key={`up-${index}`} card={card} size="sm" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default StudRenderer
