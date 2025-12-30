/**
 * HeroDetailPopover - Tap-to-reveal hero seat details
 * 
 * Phase 2 Feature: Shows expanded hero info on tap with auto-dismiss.
 * Positioned near hero seat, anchored to avoid overlapping community cards.
 * 
 * Features:
 * - Full username (no truncation)
 * - Stack amount (tabular-nums)
 * - Seat position / dealer indicator
 * - Auto-dismiss after 2-3 seconds
 * - Dismiss on tap outside
 * - RTL support with dir="auto" and unicode-bidi: plaintext
 * - Respects prefers-reduced-motion
 */

import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { formatChips } from '@/utils/formatChips'
import clsx from 'clsx'

export interface HeroDetailPopoverProps {
  /** Full player display name */
  displayName: string
  /** Current stack amount */
  stack: number
  /** Seat index (0-based) */
  seatIndex: number
  /** Whether player is dealer */
  isDealer?: boolean
  /** Whether player is small blind */
  isSmallBlind?: boolean
  /** Whether player is big blind */
  isBigBlind?: boolean
  /** Whether player is sitting out */
  isSittingOut?: boolean
  /** Callback when popover should close */
  onClose: () => void
  /** Additional CSS class */
  className?: string
}

export function HeroDetailPopover({
  displayName,
  stack,
  seatIndex,
  isDealer = false,
  isSmallBlind = false,
  isBigBlind = false,
  isSittingOut = false,
  onClose,
  className,
}: HeroDetailPopoverProps) {
  const { t } = useTranslation()
  const overlayRef = useRef<HTMLDivElement>(null)
  
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (overlayRef.current && !overlayRef.current.contains(target)) {
        onClose()
      }
    }
    
    // Small delay to prevent immediate close on the tap that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }, 50)
    
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [onClose])
  
  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])
  
  // Determine position label
  const getPositionLabel = (): string | null => {
    if (isDealer) return t('table.position.dealer', { defaultValue: 'Dealer' })
    if (isSmallBlind) return t('table.position.smallBlind', { defaultValue: 'Small Blind' })
    if (isBigBlind) return t('table.position.bigBlind', { defaultValue: 'Big Blind' })
    return null
  }
  
  const positionLabel = getPositionLabel()
  
  return (
    <div
      ref={overlayRef}
      className={clsx('hero-detail-overlay', className)}
      role="dialog"
      aria-label={t('table.hero.detailsLabel', { defaultValue: 'Player details' })}
    >
      {/* Full username - RTL safe */}
      <div 
        className="hero-detail-overlay__name"
        dir="auto"
      >
        {displayName || t('table.meta.unknown', { defaultValue: 'Unknown Player' })}
      </div>
      
      {/* Stack amount */}
      <div className="hero-detail-overlay__stack">
        {formatChips(stack)}
      </div>
      
      {/* Meta badges */}
      <div className="hero-detail-overlay__meta">
        {/* Seat number */}
        <span className="hero-detail-overlay__badge">
          {t('table.seat.number', { number: seatIndex + 1, defaultValue: `Seat ${seatIndex + 1}` })}
        </span>
        
        {/* Position badge (Dealer/SB/BB) */}
        {positionLabel && (
          <span className="hero-detail-overlay__badge hero-detail-overlay__badge--dealer">
            {positionLabel}
          </span>
        )}
        
        {/* YOU badge */}
        <span className="hero-detail-overlay__badge hero-detail-overlay__badge--you">
          {t('table.players.youTag', { defaultValue: 'YOU' })}
        </span>
        
        {/* Sitting out indicator */}
        {isSittingOut && (
          <span className="hero-detail-overlay__badge">
            {t('table.status.sittingOut', { defaultValue: 'Sitting Out' })}
          </span>
        )}
      </div>
    </div>
  )
}

export default HeroDetailPopover
