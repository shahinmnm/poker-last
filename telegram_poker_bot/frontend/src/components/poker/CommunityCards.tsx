import { useState, useEffect } from 'react'
import PlayingCard from '@/components/ui/PlayingCard'
import { pokerTokens } from '@/design/tokens'

export interface CommunityCardsProps {
  cards: string[]
  highlightedCards?: string[]
  maxCards?: number
  className?: string
}

/**
 * CommunityCards - Displays the flop, turn, and river cards
 * Shows placeholders before cards are dealt with reveal animations
 */
export default function CommunityCards({
  cards = [],
  highlightedCards = [],
  maxCards = 5,
  className = '',
}: CommunityCardsProps) {
  const [revealedCards, setRevealedCards] = useState<string[]>([])

  useEffect(() => {
    // Stagger card reveals
    if (cards.length > revealedCards.length) {
      const newCards = cards.slice(revealedCards.length)
      newCards.forEach((card, index) => {
        setTimeout(() => {
          setRevealedCards((prev) => [...prev, card])
        }, index * 120) // 120ms delay between each card
      })
    } else if (cards.length < revealedCards.length) {
      // Reset when cards array becomes shorter (new hand)
      setRevealedCards([])
    }
  }, [cards, revealedCards.length])

  // Create array of card slots
  const slots = Array.from({ length: maxCards }, (_, i) => {
    const card = revealedCards[i]
    const isRevealed = !!card
    const isHighlighted = card && highlightedCards.includes(card)
    const delayClass = `card-delay-${i + 1}`

    return { card, isRevealed, isHighlighted, index: i, delayClass }
  })

  return (
    <div className={`flex gap-2 ${className}`}>
      {slots.map(({ card, isRevealed, isHighlighted, index, delayClass }) => (
        <div
          key={index}
          className={`transition-all ${isRevealed ? `animate-card-reveal ${delayClass}` : ''}`}
        >
          {isRevealed && card ? (
            <PlayingCard
              card={card}
              size="md"
              highlighted={isHighlighted ? true : undefined}
            />
          ) : (
            <CardPlaceholder />
          )}
        </div>
      ))}
    </div>
  )
}

function CardPlaceholder() {
  return (
    <div
      className="rounded-lg"
      style={{
        width: '3.5rem',   // ~56px for md size
        height: '4.9rem',  // ~78px for md size (4:3 ratio)
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: `blur(${pokerTokens.effects.blur.sm})`,
        border: `1px solid ${pokerTokens.colors.border.subtle}`,
      }}
    />
  )
}
