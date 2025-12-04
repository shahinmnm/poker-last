import { useState, useCallback } from 'react'

/**
 * DiscardAction type for external use
 * Represents the state of a discard action with selected cards
 */
export interface DiscardAction {
  selectedCards: string[]
  maxDiscards: number
}

interface DiscardActionBarProps {
  heroCards: string[]
  maxDiscards: number
  onDiscard: (cardsToDiscard: string[]) => void
  onStandPat: () => void
  isProcessing: boolean
  isMyTurn: boolean
}

/**
 * DiscardActionBar Component
 * 
 * Provides UI for selecting cards to discard in draw poker variants.
 * Structure only - no CSS styling.
 */
export default function DiscardActionBar({
  heroCards,
  maxDiscards,
  onDiscard,
  onStandPat,
  isProcessing,
  isMyTurn,
}: DiscardActionBarProps) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())

  const toggleCardSelection = useCallback((card: string) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(card)) {
        newSet.delete(card)
      } else if (newSet.size < maxDiscards) {
        newSet.add(card)
      }
      return newSet
    })
  }, [maxDiscards])

  const handleDiscard = useCallback(() => {
    if (selectedCards.size === 0) return
    onDiscard(Array.from(selectedCards))
    setSelectedCards(new Set())
  }, [selectedCards, onDiscard])

  const handleStandPat = useCallback(() => {
    onStandPat()
    setSelectedCards(new Set())
  }, [onStandPat])

  const isDisabled = isProcessing || !isMyTurn

  return (
    <div data-component="discard-action-bar">
      <div data-section="card-selection">
        <h3>Select cards to discard (max {maxDiscards})</h3>
        <div data-cards-container>
          {heroCards.map((card) => (
            <button
              key={card}
              data-card={card}
              data-selected={selectedCards.has(card)}
              onClick={() => toggleCardSelection(card)}
              disabled={isDisabled || (!selectedCards.has(card) && selectedCards.size >= maxDiscards)}
            >
              {card}
              {selectedCards.has(card) && <span data-marker="selected">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <div data-section="actions">
        <button
          onClick={handleStandPat}
          disabled={isDisabled}
          data-action="stand-pat"
        >
          Stand Pat (Keep all cards)
        </button>
        <button
          onClick={handleDiscard}
          disabled={isDisabled || selectedCards.size === 0}
          data-action="discard"
        >
          Discard {selectedCards.size} card{selectedCards.size !== 1 ? 's' : ''}
        </button>
      </div>

      <div data-section="info">
        <span>Cards selected: {selectedCards.size}/{maxDiscards}</span>
      </div>
    </div>
  )
}
