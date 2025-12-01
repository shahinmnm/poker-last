/**
 * PlayingCard component - displays a poker card with proper rank and suit symbols
 */

import { useMemo } from 'react'
import clsx from 'clsx'

export interface PlayingCardProps {
  /** Card string in format like "Ah", "Kd", "Ts", "2c" */
  card: string
  /** Size of the card */
  size?: 'sm' | 'md' | 'lg'
  /** Whether to show card back (hidden card) */
  hidden?: boolean
  /** Whether to highlight the card (for winning cards) */
  highlighted?: boolean
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

export default function PlayingCard({ card, size = 'sm', hidden = false, highlighted = false }: PlayingCardProps) {
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
      case 'xs':
        return 'w-[26px] h-[38px] text-[10px]'
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
        className={`${sizeClasses} relative overflow-hidden rounded-md border border-slate-700/60 bg-[#0b142b] shadow-[0_10px_24px_-16px_rgba(0,0,0,0.8)]`}
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(86,105,255,0.16) 0, rgba(86,105,255,0.16) 4px, transparent 4px, transparent 10px), repeating-linear-gradient(-45deg, rgba(86,105,255,0.16) 0, rgba(86,105,255,0.16) 4px, transparent 4px, transparent 10px)',
          }}
        />
        <div
          className="absolute inset-0 opacity-75"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25% 30%, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 2px, transparent 3px), radial-gradient(circle at 70% 70%, rgba(56,189,248,0.14) 0, rgba(56,189,248,0.14) 2px, transparent 3px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="absolute inset-[2px] rounded-sm border border-slate-300/20" />
        <div className="relative h-full w-full" />
      </div>
    )
  }

  return (
    <div
      className={`${sizeClasses} rounded-md bg-white border-[1.5px] shadow-md flex flex-col items-center justify-center font-bold tracking-tight ${color} relative ${
        highlighted ? 'border-emerald-400 ring-2 ring-emerald-400/80 shadow-emerald-500/30' : 'border-gray-300'
      }`}
      style={{
        backgroundImage: 'linear-gradient(to bottom, #ffffff, #f5f5f5)',
      }}
    >
      {/* Main rank and suit */}
      <div className="flex flex-col items-center gap-0.5">
        <span className={clsx('leading-none', size === 'xs' ? 'text-[11px]' : '')}>{rank}</span>
        <span className={clsx('leading-none', size === 'xs' ? 'text-sm' : 'text-lg')}>{suit}</span>
      </div>
    </div>
  )
}
