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
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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

  // Empty seat - minimal placeholder with proper touch target
  if (isEmpty) {
    return (
      <div
        className={`${seatClasses} ${className}`}
        data-seat-index={seat_index}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick()
          }
        } : undefined}
      >
        <div className="min-h-[44px] min-w-[44px] w-10 h-10 rounded-full border-2 border-dashed border-[var(--border-2)] flex items-center justify-center text-[var(--text-3)] text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300/60">
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
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-warning)] rounded-full flex items-center justify-center text-[8px] font-bold text-black z-20 shadow-md">
              D
            </div>
          )}
          
          {/* Acting ring with animation - motion-reduce respects prefers-reduced-motion via CSS */}
          {is_acting && isActing && (
            <div className="absolute inset-0 rounded-full ring-2 ring-[var(--color-warning)] animate-pulse motion-reduce:animate-none" />
          )}
          
          {/* Winner highlight */}
          {is_winner && (
            <div className="absolute inset-0 rounded-full ring-2 ring-[var(--color-success)] animate-pulse motion-reduce:animate-none" />
          )}
          
          {/* Avatar - compact size w-10 h-10 with premium surface */}
          <div className="avatar w-10 h-10 rounded-full overflow-hidden bg-gradient-to-b from-slate-800/95 to-slate-900/95 ring-2 ring-[var(--border-2)]">
            {avatar_url ? (
              <img src={avatar_url} alt={display_name || t('table.meta.unknown', { defaultValue: 'Player' })} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-[var(--text-1)]">
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
          
          {/* Info pill - overlapping bottom 30% of avatar with premium styling */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[var(--surface-1)] backdrop-blur-md rounded-xl px-2 py-0.5 border border-[var(--border-2)] shadow-lg shadow-black/40 whitespace-nowrap">
            <div className="flex flex-col items-center">
              <div 
                className="text-[10px] font-bold text-[var(--text-1)] truncate max-w-[60px] leading-tight tracking-tight"
                dir="auto"
                title={display_name || t('table.meta.unknown', { defaultValue: 'Anon' })}
              >
                {display_name || t('table.meta.unknown', { defaultValue: 'Anon' })}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold leading-tight tabular-nums mt-0.5">
                {formatByCurrency(stack_amount, currency)}
              </div>
            </div>
          </div>
        </div>

        {/* Status badges below avatar - compact */}
        <div className="mt-4 flex flex-col items-center gap-0.5">
          {current_bet > 0 && (
            <div className="status-badge-safe bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {formatByCurrency(current_bet, currency)}
            </div>
          )}
          {is_all_in && (
            <div className="status-badge-safe bg-[var(--color-danger-soft)] text-[var(--color-danger)] text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {t('table.actions.allIn', { defaultValue: 'ALL IN' })}
            </div>
          )}
          {is_sitting_out && (
            <div className="status-badge-safe bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {t('table.status.sittingOut', { defaultValue: 'Zzz' })}
            </div>
          )}
          {isHero && (
            <div className="status-badge-safe bg-[var(--color-info-bg)] text-[var(--color-info-text)] text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {t('table.players.youTag', { defaultValue: 'YOU' })}
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
