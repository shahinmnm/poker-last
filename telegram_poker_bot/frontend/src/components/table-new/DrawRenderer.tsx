/**
 * Phase 5: DrawRenderer Component
 * 
 * Specialized UI for draw poker variants.
 * Shows discard phase UI and stand pat option.
 */

import { useState } from 'react'
import type { Card, CardCode } from '../../types/normalized'
import CardRenderer from './CardRenderer'
import Button from '../ui/Button'

interface DrawRendererProps {
  holeCards: Card[]
  discardPhaseActive: boolean
  discardLimits?: { min: number; max: number }
  onDiscard?: (cards: CardCode[]) => void
  onStandPat?: () => void
  className?: string
}

export function DrawRenderer({
  holeCards,
  discardPhaseActive,
  discardLimits,
  onDiscard,
  onStandPat,
  className = '',
}: DrawRendererProps) {
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set())

  const toggleCard = (index: number) => {
    const newSelected = new Set(selectedCards)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      // Check max limit
      if (discardLimits && newSelected.size >= discardLimits.max) {
        return // Cannot select more cards
      }
      newSelected.add(index)
    }
    setSelectedCards(newSelected)
  }

  const handleDiscard = () => {
    if (!onDiscard) return
    
    // Get card codes of selected cards
    const cardCodes: CardCode[] = Array.from(selectedCards).map((index) => {
      const card = holeCards[index]
      if (typeof card === 'string') return card
      return `${card.rank}${card.suit}`
    })
    
    onDiscard(cardCodes)
    setSelectedCards(new Set())
  }

  const handleStandPat = () => {
    if (!onStandPat) return
    onStandPat()
    setSelectedCards(new Set())
  }

  const canDiscard =
    discardLimits &&
    selectedCards.size >= discardLimits.min &&
    selectedCards.size <= discardLimits.max

  return (
    <div className={`draw-renderer ${className}`}>
      <div className="flex flex-col items-center gap-3">
        {/* Hole cards with selection */}
        <div className="hole-cards flex gap-2">
          {holeCards.map((card, index) => {
            const isSelected = selectedCards.has(index)
            return (
              <div
                key={index}
                className={`relative cursor-pointer transition-transform ${
                  isSelected ? '-translate-y-2' : ''
                } ${discardPhaseActive ? 'hover:-translate-y-1' : ''}`}
                onClick={() => discardPhaseActive && toggleCard(index)}
              >
                <CardRenderer card={card} size="md" />
                {isSelected && discardPhaseActive && (
                  <div className="absolute inset-0 border-4 border-yellow-400 rounded-lg pointer-events-none" />
                )}
              </div>
            )
          })}
        </div>

        {/* Discard phase controls */}
        {discardPhaseActive && (
          <div className="discard-controls flex gap-2">
            {discardLimits && (
              <div className="text-xs text-gray-400 mb-2">
                Select {discardLimits.min}-{discardLimits.max} cards to discard
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleDiscard}
                disabled={!canDiscard}
                variant="primary"
                size="sm"
              >
                Discard ({selectedCards.size})
              </Button>
              <Button
                onClick={handleStandPat}
                variant="secondary"
                size="sm"
              >
                Stand Pat
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DrawRenderer
