/**
 * Phase 5: Seat Component
 * 
 * Renders a player seat with compact, peripheral design:
 * - Small avatar (w-10 h-10 to w-12 h-12) with ring border
 * - Pill overlay at bottom of avatar (overlapping 30%)
 * - Badges positioned close to avatar border
 * - Cards displayed compactly below
 * - Timer integrated with avatar
 */

import { useMemo } from 'react'
import type { Seat as SeatType } from '../../types/normalized'
import CardRenderer from './CardRenderer'
import CircularTimer from './CircularTimer'
import { formatByCurrency, type CurrencyType } from '@/utils/currency'

interface SeatProps {
  seat: SeatType
  actionDeadline?: number | null
  currency?: CurrencyType
  onClick?: () => void
  className?: string
  isHero?: boolean
  isActing?: boolean
}

export function Seat({
  seat,
  actionDeadline,
  currency = 'PLAY',
  onClick,
  className = '',
  isHero = false,
  isActing = false,
}: SeatProps) {
  const {
    seat_index,
    user_id,
    display_name,
    avatar_url,
    stack_amount,
    current_bet,
    is_acting,
    is_sitting_out,
    is_winner,
    is_button,
    hole_cards,
    is_all_in,
  } = seat

  const isEmpty = user_id === null

  const seatClasses = useMemo(() => {
    const classes = ['seat-component', 'relative']
    if (is_acting && isActing) classes.push('seat-acting')
    if (is_winner) classes.push('seat-winner')
    if (is_sitting_out) classes.push('seat-sitting-out')
    if (isEmpty) classes.push('seat-empty')
    if (isHero) classes.push('seat-hero')
    if (onClick) classes.push('cursor-pointer')
    return classes.join(' ')
  }, [is_acting, isActing, is_winner, is_sitting_out, isEmpty, isHero, onClick])

  // Empty seat - minimal placeholder
  if (isEmpty) {
    return (
      <div
        className={`${seatClasses} ${className}`}
        data-seat-index={seat_index}
        onClick={onClick}
      >
        <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-600/50 flex items-center justify-center text-gray-500 text-xs">
          {seat_index + 1}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${seatClasses} ${className}`}
      data-seat-index={seat_index}
      data-user-id={user_id}
      onClick={onClick}
    >
      {/* Seat container - compact vertical layout */}
      <div className="seat-content flex flex-col items-center">
        {/* Avatar container with overlapping pill */}
        <div className={`relative ${is_sitting_out ? 'opacity-50' : ''}`}>
          {/* Dealer button badge - positioned at top-right of avatar */}
          {is_button && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[8px] font-bold text-black z-20 shadow-md">
              D
            </div>
          )}
          
          {/* Acting ring with animation */}
          {is_acting && isActing && (
            <div className="absolute inset-0 rounded-full ring-2 ring-yellow-400 animate-pulse" />
          )}
          
          {/* Winner highlight */}
          {is_winner && (
            <div className="absolute inset-0 rounded-full ring-2 ring-green-400 animate-pulse" />
          )}
          
          {/* Avatar - compact size w-10 h-10 */}
          <div className="avatar w-10 h-10 rounded-full overflow-hidden bg-gray-700 ring-2 ring-white/10">
            {avatar_url ? (
              <img src={avatar_url} alt={display_name || 'Player'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-400">
                {display_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          
          {/* Timer (only when acting) - positioned around avatar */}
          {is_acting && actionDeadline && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
              <CircularTimer deadline={actionDeadline} size={24} strokeWidth={2} />
            </div>
          )}
          
          {/* Info pill - overlapping bottom 30% of avatar */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/10 shadow-md whitespace-nowrap">
            <div className="flex flex-col items-center">
              <div className="text-[10px] text-gray-300 truncate max-w-[60px] leading-tight">
                {display_name || 'Anon'}
              </div>
              <div className="text-[10px] text-emerald-400 font-bold leading-tight">
                {formatByCurrency(stack_amount, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Status badges below avatar - compact */}
        <div className="mt-4 flex flex-col items-center gap-0.5">
          {current_bet > 0 && (
            <div className="bg-yellow-500/20 text-yellow-400 text-[9px] font-medium px-1.5 py-0.5 rounded-full">
              {formatByCurrency(current_bet, currency)}
            </div>
          )}
          {is_all_in && (
            <div className="bg-red-500/20 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              ALL IN
            </div>
          )}
          {is_sitting_out && (
            <div className="bg-yellow-500/20 text-yellow-500 text-[9px] font-medium px-1.5 py-0.5 rounded-full">
              Zzz
            </div>
          )}
          {isHero && (
            <div className="bg-blue-500/20 text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              YOU
            </div>
          )}
        </div>

        {/* Hole cards - compact display */}
        {hole_cards && hole_cards.length > 0 && !is_sitting_out && (
          <div className="hole-cards flex gap-0.5 mt-1">
            {hole_cards.map((card, index) => (
              <CardRenderer
                key={index}
                card={card}
                size="sm"
                animate={is_winner}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Seat
