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
  /** Whether to highlight the card (for winning cards) */
  highlighted?: boolean
  /** Optional className for custom layout tweaks */
  className?: string
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

export default function PlayingCard({
  card,
  size = 'sm',
  hidden = false,
  highlighted = false,
  className = '',
}: PlayingCardProps) {
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
        return 'h-20 w-14 text-lg'
      case 'md':
        return 'h-14 w-10 text-base'
      case 'sm':
      default:
        return 'h-11 w-8 text-xs'
    }
  }, [size])

  if (hidden) {
    return (
      <div
        className={`${sizeClasses} relative flex items-center justify-center overflow-hidden rounded-md border border-emerald-300/40 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 shadow-[0_10px_24px_-12px_rgba(0,0,0,0.6)] ${className}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,211,153,0.28),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.22),transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_40%,rgba(255,255,255,0.08)_100%)]" />
        <div className="absolute inset-[6%] rounded-sm border border-white/10" />
        <div className="absolute inset-0 rotate-12 bg-[repeating-linear-gradient(45deg,rgba(12,74,57,0.4)_0px,rgba(12,74,57,0.4)_6px,rgba(16,185,129,0.16)_6px,rgba(16,185,129,0.16)_12px)] opacity-50" />
        <span className="relative text-[10px] font-semibold uppercase tracking-[0.45em] text-emerald-50">Deck</span>
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses} relative flex flex-col items-center justify-center rounded-md border shadow-md shadow-[0_8px_18px_rgba(0,0,0,0.35)] bg-white/95 font-bold tracking-tight ${color} ${
        highlighted
          ? 'border-emerald-400 ring-2 ring-emerald-300/70 shadow-emerald-500/30'
          : 'border-gray-200'
      } ${className}`}
      style={{
        backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #f7f7f7 60%, #f0f0f0 100%)',
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
