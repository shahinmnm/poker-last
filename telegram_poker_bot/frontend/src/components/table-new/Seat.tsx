/**
 * Phase 5: Seat Component
 * 
 * Renders a player seat with:
 * - Avatar + ring
 * - Button indicator
 * - Info pill (stack, bet)
 * - Cards (hole cards with visibility control)
 * - Timer
 */

import { useMemo } from 'react'
import type { Seat as SeatType } from '../../types/normalized'
import CardRenderer from './CardRenderer'
import CircularTimer from './CircularTimer'
import { formatByCurrency } from '@/utils/currency'

interface SeatProps {
  seat: SeatType
  actionDeadline?: number | null
  currency?: string
  isSelf?: boolean
  onClick?: () => void
  className?: string
}

export function Seat({
  seat,
  actionDeadline,
  currency = 'chips',
  isSelf = false,
  onClick,
  className = '',
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
    if (is_acting) classes.push('seat-acting')
    if (is_winner) classes.push('seat-winner')
    if (is_sitting_out) classes.push('seat-sitting-out')
    if (isEmpty) classes.push('seat-empty')
    if (onClick) classes.push('cursor-pointer')
    return classes.join(' ')
  }, [is_acting, is_winner, is_sitting_out, isEmpty, onClick])

  // Empty seat
  if (isEmpty) {
    return (
      <div
        className={`${seatClasses} ${className}`}
        data-seat-index={seat_index}
        onClick={onClick}
      >
        <div className="seat-empty-placeholder w-16 h-16 rounded-full border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500">
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
      {/* Seat container */}
      <div className="seat-content flex flex-col items-center gap-2">
        {/* Avatar with ring */}
        <div className="relative">
          {/* Acting ring */}
          {is_acting && (
            <div className="absolute inset-0 rounded-full border-4 border-yellow-400 animate-pulse" />
          )}
          
          {/* Winner highlight */}
          {is_winner && (
            <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-win-highlight" />
          )}
          
          {/* Button indicator */}
          {is_button && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-bold text-black">
              D
            </div>
          )}
          
          {/* Avatar */}
          <div className="avatar w-16 h-16 rounded-full overflow-hidden bg-gray-700 border-2 border-gray-600">
            {avatar_url ? (
              <img src={avatar_url} alt={display_name || 'Player'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                {display_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>
          
          {/* Timer (only when acting) */}
          {is_acting && actionDeadline && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
              <CircularTimer deadline={actionDeadline} size={40} strokeWidth={3} />
            </div>
          )}
        </div>

        {/* Info pill */}
        <div className="info-pill bg-gray-800 rounded-full px-3 py-1 min-w-[100px] text-center">
          <div className="display-name text-xs font-semibold text-white truncate max-w-[120px]">
            {display_name || 'Anonymous'}
          </div>
          <div className="stack text-xs font-mono text-green-400">
            {formatByCurrency(stack_amount, currency)}
          </div>
          {current_bet > 0 && (
            <div className="current-bet text-xs font-mono text-yellow-400">
              Bet: {formatByCurrency(current_bet, currency)}
            </div>
          )}
          {is_all_in && (
            <div className="all-in-badge text-xs font-bold text-red-400">
              ALL IN
            </div>
          )}
          {is_sitting_out && (
            <div className="sitting-out-badge text-xs text-gray-500">
              Sitting Out
            </div>
          )}
        </div>

        {/* Hole cards */}
        {hole_cards && hole_cards.length > 0 && (
          <div className="hole-cards flex gap-1 mt-1">
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
