/**
 * PlayerSpot - Individual player position with avatar, status, and cards
 * 
 * Features:
 * - Circular avatar with status ring (green=turn, red=low time, transparent=waiting)
 * - Info capsule showing chip count and name
 * - Card display (2 cards for hero with tilt, card backs for opponents)
 */

import { useMemo } from 'react'
import PlayingCard from '../ui/PlayingCard'

export interface PlayerSpotProps {
  /** Player display name */
  name: string
  /** Player chip count */
  chips: number
  /** Player cards (empty array for no cards, undefined for hidden cards) */
  cards?: string[]
  /** Whether this is the hero (current user) */
  isHero?: boolean
  /** Whether it's this player's turn */
  isTurn?: boolean
  /** Whether time is running low */
  isLowTime?: boolean
  /** Whether player has folded */
  hasFolded?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

export default function PlayerSpot({
  name,
  chips,
  cards,
  isHero = false,
  isTurn = false,
  isLowTime = false,
  hasFolded = false,
  size = 'md',
}: PlayerSpotProps) {
  const avatarSize = useMemo(() => {
    switch (size) {
      case 'sm':
        return 'w-12 h-12'
      case 'lg':
        return 'w-20 h-20'
      case 'md':
      default:
        return 'w-16 h-16'
    }
  }, [size])

  const ringColor = useMemo(() => {
    if (!isTurn) return 'border-transparent'
    if (isLowTime) return 'border-red-500 animate-pulse'
    return 'border-emerald-500'
  }, [isTurn, isLowTime])

  const cardSize = isHero ? 'md' : 'sm'
  const hasCards = cards && cards.length > 0
  const showCardBacks = cards === undefined && !hasFolded

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Cards - Above avatar */}
      {isHero && hasCards && (
        <div className="flex gap-1.5 mb-1">
          {cards.map((card, idx) => (
            <div
              key={`card-${idx}`}
              className="transition-transform"
              style={{
                transform: idx === 0 ? 'rotate(-3deg)' : 'rotate(3deg)',
              }}
            >
              <PlayingCard card={card} size={cardSize} />
            </div>
          ))}
        </div>
      )}

      {/* Avatar with Status Ring */}
      <div className="relative">
        <div
          className={`${avatarSize} rounded-full border-4 ${ringColor} transition-all duration-300 overflow-hidden bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center`}
        >
          {/* Avatar Content - Using initials */}
          <span className="text-white font-bold text-lg">
            {name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || '?'}
          </span>
        </div>

        {/* Folded overlay */}
        {hasFolded && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <span className="text-white text-xs font-semibold">FOLD</span>
          </div>
        )}
      </div>

      {/* Info Capsule - Below avatar */}
      <div className="rounded-full bg-black/60 backdrop-blur-sm px-3 py-1 border border-white/20 min-w-[80px] text-center">
        <div className="text-white font-bold text-sm">{chips}</div>
        <div className="text-gray-400 text-xs truncate max-w-[100px]">{name}</div>
      </div>

      {/* Cards - For opponents (card backs) */}
      {!isHero && showCardBacks && (
        <div className="flex gap-1 mt-1">
          <PlayingCard card="" size={cardSize} hidden />
          <PlayingCard card="" size={cardSize} hidden />
        </div>
      )}
    </div>
  )
}
