/**
 * PlayingCard component - displays a poker card with proper rank and suit symbols
 */

import { useMemo } from 'react'

export interface PlayingCardProps {
  /** Card string in format like "Ah", "Kd", "Ts", "2c" */
  card: string
  /** Size of the card */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show card back (hidden card) */
  hidden?: boolean
}

// Map suit letters to Unicode symbols
const SUIT_SYMBOLS: Record<string, string> = {
  's': '♠', // spades
  'h': '♥', // hearts
  'd': '♦', // diamonds
  'c': '♣', // clubs
}

// Map rank letters to display values
const RANK_DISPLAY: Record<string, string> = {
  'A': 'A',
  'K': 'K',
  'Q': 'Q',
  'J': 'J',
  'T': '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
}

export default function PlayingCard({ card, size = 'sm', hidden = false }: PlayingCardProps) {
  const { rank, suit, color } = useMemo(() => {
    if (!card || card.length < 2) {
      return { rank: '?', suit: '', color: 'text-gray-400' }
    }
    
    const rankChar = card[0].toUpperCase()
    const suitChar = card[1].toLowerCase()
    
    const displayRank = RANK_DISPLAY[rankChar] || rankChar
    const displaySuit = SUIT_SYMBOLS[suitChar] || suitChar
    
    // Red for hearts and diamonds, black/blue for spades and clubs
    const suitColor = (suitChar === 'h' || suitChar === 'd') 
      ? 'text-rose-400' 
      : 'text-sky-300'
    
    return {
      rank: displayRank,
      suit: displaySuit,
      color: suitColor,
    }
  }, [card])

  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'lg':
        return 'w-14 h-20 text-lg'
      case 'md':
        return 'w-10 h-14 text-base'
      case 'sm':
      default:
        return 'w-8 h-11 text-xs'
    }
  }, [size])

  if (hidden) {
    return (
      <div
        className={`${sizeClasses} rounded-lg bg-gradient-to-br from-blue-900 to-blue-700 border border-blue-600/50 shadow-md flex items-center justify-center`}
      >
        <span className="text-blue-300 text-2xl">🂠</span>
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses} rounded-lg bg-white border-2 border-gray-300 shadow-md flex flex-col items-center justify-center font-bold tracking-tight ${color} relative`}
      style={{ 
        backgroundImage: 'linear-gradient(to bottom, #ffffff, #f8f8f8)',
      }}
    >
      {/* Main rank and suit */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="leading-none">{rank}</span>
        <span className="leading-none text-lg">{suit}</span>
      </div>
    </div>
  )
}
