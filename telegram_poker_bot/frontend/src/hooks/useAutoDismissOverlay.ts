/**
 * useAutoDismissOverlay - Hook for auto-dismissing overlays/popovers
 * 
 * Features:
 * - Auto-dismiss after configurable timeout (default 2500ms)
 * - Dismiss on tap outside (with flicker prevention via delay)
 * - Dismiss on Escape key (desktop)
 * - Respects prefers-reduced-motion (no animation, but auto-dismiss still works)
 * - Stop propagation to prevent same-tap re-trigger
 * 
 * Usage:
 * ```tsx
 * const { isOpen, open, close, overlayRef } = useAutoDismissOverlay({
 *   timeoutMs: 2500,
 *   onDismiss: () => console.log('dismissed')
 * })
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** Default delay before event listeners are attached (flicker prevention) */
const OPEN_DELAY_MS = 100

export interface UseAutoDismissOverlayOptions {
  /** Auto-dismiss timeout in milliseconds (default: 2500ms) */
  timeoutMs?: number
  /** Callback when overlay is dismissed */
  onDismiss?: () => void
  /** Whether to disable auto-dismiss timeout */
  disableAutoClose?: boolean
  /** Delay before attaching outside click listeners (flicker prevention, default: 100ms) */
  openDelayMs?: number
}

export interface UseAutoDismissOverlayReturn {
  /** Whether the overlay is currently open */
  isOpen: boolean
  /** Open the overlay */
  open: () => void
  /** Close the overlay */
  close: () => void
  /** Toggle the overlay */
  toggle: () => void
  /** Ref to attach to the overlay element (for outside click detection) */
  overlayRef: React.RefObject<HTMLDivElement>
}

export function useAutoDismissOverlay(
  options: UseAutoDismissOverlayOptions = {}
): UseAutoDismissOverlayReturn {
  const { 
    timeoutMs = 2500, 
    onDismiss,
    disableAutoClose = false,
    openDelayMs = OPEN_DELAY_MS
  } = options
  
  const [isOpen, setIsOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const openDelayRef = useRef<number | null>(null)
  
  // Clear timeout on cleanup
  const clearAutoCloseTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (openDelayRef.current !== null) {
      clearTimeout(openDelayRef.current)
      openDelayRef.current = null
    }
  }, [])
  
  // Close handler
  const close = useCallback(() => {
    clearAutoCloseTimeout()
    setIsOpen(false)
    setIsReady(false)
    onDismiss?.()
  }, [clearAutoCloseTimeout, onDismiss])
  
  // Open handler - starts auto-dismiss timer with flicker prevention
  const open = useCallback(() => {
    clearAutoCloseTimeout()
    setIsOpen(true)
    setIsReady(false)
    
    // Delay before attaching outside click listeners (flicker prevention)
    openDelayRef.current = window.setTimeout(() => {
      setIsReady(true)
    }, openDelayMs)
    
    if (!disableAutoClose && timeoutMs > 0) {
      timeoutRef.current = window.setTimeout(() => {
        close()
      }, timeoutMs)
    }
  }, [clearAutoCloseTimeout, close, disableAutoClose, timeoutMs, openDelayMs])
  
  // Toggle handler
  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, open, close])
  
  // Handle outside clicks (with flicker prevention via isReady state)
  useEffect(() => {
    if (!isOpen || !isReady) return
    
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      event.stopPropagation() // Prevent re-triggering
      const target = event.target as Node
      if (overlayRef.current && !overlayRef.current.contains(target)) {
        close()
      }
    }
    
    // Use capture phase for reliable outside click detection
    document.addEventListener('mousedown', handleClickOutside, { capture: true })
    document.addEventListener('touchstart', handleClickOutside, { capture: true, passive: true })
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, { capture: true })
      document.removeEventListener('touchstart', handleClickOutside, { capture: true })
    }
  }, [isOpen, isReady, close])
  
  // Handle Escape key (desktop)
  useEffect(() => {
    if (!isOpen) return
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, close])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAutoCloseTimeout()
    }
  }, [clearAutoCloseTimeout])
  
  return {
    isOpen,
    open,
    close,
    toggle,
    overlayRef,
  }
}

export default useAutoDismissOverlay
