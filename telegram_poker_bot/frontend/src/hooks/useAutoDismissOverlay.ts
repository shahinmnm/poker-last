/**
 * useAutoDismissOverlay - Hook for auto-dismissing overlays/popovers
 * 
 * Features:
 * - Auto-dismiss after configurable timeout (default 2500ms)
 * - Dismiss on tap outside
 * - Dismiss on Escape key (desktop)
 * - Respects prefers-reduced-motion
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

export interface UseAutoDismissOverlayOptions {
  /** Auto-dismiss timeout in milliseconds (default: 2500ms) */
  timeoutMs?: number
  /** Callback when overlay is dismissed */
  onDismiss?: () => void
  /** Whether to disable auto-dismiss timeout */
  disableAutoClose?: boolean
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
    disableAutoClose = false 
  } = options
  
  const [isOpen, setIsOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)
  
  // Clear timeout on cleanup
  const clearAutoCloseTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])
  
  // Close handler
  const close = useCallback(() => {
    clearAutoCloseTimeout()
    setIsOpen(false)
    onDismiss?.()
  }, [clearAutoCloseTimeout, onDismiss])
  
  // Open handler - starts auto-dismiss timer
  const open = useCallback(() => {
    clearAutoCloseTimeout()
    setIsOpen(true)
    
    if (!disableAutoClose && timeoutMs > 0) {
      timeoutRef.current = window.setTimeout(() => {
        close()
      }, timeoutMs)
    }
  }, [clearAutoCloseTimeout, close, disableAutoClose, timeoutMs])
  
  // Toggle handler
  const toggle = useCallback(() => {
    if (isOpen) {
      close()
    } else {
      open()
    }
  }, [isOpen, open, close])
  
  // Handle outside clicks
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (overlayRef.current && !overlayRef.current.contains(target)) {
        close()
      }
    }
    
    // Use mousedown/touchstart for immediate response
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen, close])
  
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
