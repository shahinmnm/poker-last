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
 * - Auto-dismiss after 2500ms default
 * - Dismiss on tap outside (with flicker prevention)
 * - RTL support with dir="auto" and unicode-bidi: plaintext
 * - Respects prefers-reduced-motion
 * - Closes on mode transitions (SHOWDOWN, leave table, action strip expand)
 * - Constrained max-height to stay within hero zone
 * - Flip placement based on available space
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatChips } from '@/utils/formatChips'
import clsx from 'clsx'

/** Default auto-dismiss timeout in ms */
const AUTO_DISMISS_TIMEOUT = 2500

/** Delay before event listeners are attached (prevents same-tap close) */
const OPEN_DELAY_MS = 100

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
  /** UI mode for mode-transition closing (SHOWDOWN triggers close) */
  uiMode?: 'PLAYER_ACTION' | 'OPPONENT_ACTION' | 'SHOWDOWN' | 'WAITING'
  /** Whether action strip is expanded (triggers close) */
  actionStripExpanded?: boolean
  /** Custom auto-dismiss timeout in ms (default: 2500) */
  autoDismissMs?: number
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
  uiMode,
  actionStripExpanded = false,
  autoDismissMs = AUTO_DISMISS_TIMEOUT,
}: HeroDetailPopoverProps) {
  const { t } = useTranslation()
  const overlayRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)
  const autoDismissRef = useRef<number | null>(null)
  
  // Clear auto-dismiss timer
  const clearAutoDismiss = useCallback(() => {
    if (autoDismissRef.current !== null) {
      clearTimeout(autoDismissRef.current)
      autoDismissRef.current = null
    }
  }, [])
  
  // Safe close with cleanup
  const safeClose = useCallback(() => {
    clearAutoDismiss()
    onClose()
  }, [clearAutoDismiss, onClose])
  
  // Auto-dismiss timer (respects reduced motion - no animation but still dismisses)
  useEffect(() => {
    clearAutoDismiss()
    
    if (autoDismissMs > 0) {
      autoDismissRef.current = window.setTimeout(() => {
        safeClose()
      }, autoDismissMs)
    }
    
    return () => clearAutoDismiss()
  }, [autoDismissMs, clearAutoDismiss, safeClose])
  
  // Close on mode transitions: SHOWDOWN or action strip expansion
  useEffect(() => {
    if (uiMode === 'SHOWDOWN' || actionStripExpanded) {
      safeClose()
    }
  }, [uiMode, actionStripExpanded, safeClose])
  
  // Flicker prevention: delay attaching outside click listeners
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true)
    }, OPEN_DELAY_MS)
    
    return () => {
      clearTimeout(timer)
      setIsReady(false)
    }
  }, [])
  
  // Handle click outside to close (with flicker prevention)
  useEffect(() => {
    if (!isReady) return
    
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      event.stopPropagation() // Stop propagation to prevent re-open
      const target = event.target as Node
      if (overlayRef.current && !overlayRef.current.contains(target)) {
        safeClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside, { capture: true })
    document.addEventListener('touchstart', handleClickOutside, { capture: true, passive: true })
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, { capture: true })
      document.removeEventListener('touchstart', handleClickOutside, { capture: true })
    }
  }, [isReady, safeClose])
  
  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        safeClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [safeClose])
  
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
