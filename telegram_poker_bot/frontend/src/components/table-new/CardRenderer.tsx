/**
 * Phase 5: CardRenderer Component
 * 
 * Renders playing cards with SVG support and PNG fallback.
 * Supports card codes ("As", "Kh", "Tc") and hidden cards ("XX").
 */

import { useMemo } from 'react'
import type { Card, CardCode } from '../../types/normalized'

interface CardRendererProps {
  card: Card | CardCode
  size?: 'sm' | 'md' | 'lg'
  className?: string
  animate?: boolean
}

export function CardRenderer({
  card,
  size = 'md',
  className = '',
  animate = false,
}: CardRendererProps) {
  const cardCode = useMemo(() => {
    if (typeof card === 'string') {
      return card
    }
    if (card.hidden) {
      return 'XX'
    }
    return `${card.rank}${card.suit}`
  }, [card])

  const isHidden = cardCode === 'XX' || cardCode === 'xx'

  const sizeClasses = {
    sm: 'w-10 h-14',
    md: 'w-14 h-20',
    lg: 'w-20 h-28',
  }

  const sizeClass = sizeClasses[size]

  const animateClass = animate ? 'animate-card-slide' : ''

  if (isHidden) {
    return (
      <div
        className={`playing-card card-back ${sizeClass} ${animateClass} ${className}`}
        data-card="hidden"
      >
        <div className="card-back-design">
          {/* SVG pattern for card back */}
          <svg viewBox="0 0 100 140" className="w-full h-full">
            <rect width="100" height="140" fill="#1a1f2e" rx="8" />
            <circle cx="50" cy="70" r="30" fill="#374151" opacity="0.3" />
            <circle cx="50" cy="70" r="20" fill="#4b5563" opacity="0.3" />
            <circle cx="50" cy="70" r="10" fill="#6b7280" opacity="0.3" />
          </svg>
        </div>
      </div>
    )
  }

  const rank = cardCode[0]
  const suit = cardCode[1]

  const suitSymbol = {
    s: '♠',
    h: '♥',
    d: '♦',
    c: '♣',
  }[suit.toLowerCase()] || '?'

  const suitColor = ['h', 'd'].includes(suit.toLowerCase()) ? 'text-red-600' : 'text-gray-900'

  return (
    <div
      className={`playing-card ${sizeClass} ${animateClass} ${className}`}
      data-card={cardCode}
    >
      <div className="card-face bg-white rounded-lg shadow-lg border-2 border-gray-300 flex flex-col items-center justify-center p-1 relative">
        {/* Rank and suit */}
        <div className={`card-rank font-bold ${suitColor}`}>
          {rank}
        </div>
        <div className={`card-suit text-2xl ${suitColor}`}>
          {suitSymbol}
        </div>
        
        {/* Top-left corner */}
        <div className={`absolute top-1 left-1 text-xs font-semibold ${suitColor}`}>
          {rank}
          <div className="text-sm">{suitSymbol}</div>
        </div>
        
        {/* Bottom-right corner (rotated) */}
        <div className={`absolute bottom-1 right-1 text-xs font-semibold ${suitColor} rotate-180`}>
          {rank}
          <div className="text-sm">{suitSymbol}</div>
        </div>
      </div>
    </div>
  )
}

export default CardRenderer
