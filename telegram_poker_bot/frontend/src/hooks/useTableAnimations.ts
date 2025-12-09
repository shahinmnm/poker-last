/**
 * Phase 5: useTableAnimations Hook
 * 
 * Delta-driven micro-animations for table events.
 * Triggers one-off animations without relying on React state diffs.
 */

import { useRef, useCallback, useEffect } from 'react'
import type { TableDeltaMessage } from '../types/normalized'
import confetti from 'canvas-confetti'

interface UseTableAnimationsOptions {
  onDelta?: (delta: TableDeltaMessage) => void
  audioEnabled?: boolean
}

interface UseTableAnimationsReturn {
  potRef: React.RefObject<HTMLDivElement>
  onDelta: (delta: TableDeltaMessage) => void
}

/**
 * Hook to trigger animations based on delta events.
 * 
 * Usage:
 * ```tsx
 * const { potRef, onDelta } = useTableAnimations({ audioEnabled: true })
 * 
 * // Pass onDelta to useTableSync
 * useTableSync({ tableId, onDelta })
 * 
 * // Attach potRef to the pot display element
 * <div ref={potRef}>...</div>
 * ```
 */
export function useTableAnimations(options: UseTableAnimationsOptions = {}): UseTableAnimationsReturn {
  const { onDelta: userOnDelta, audioEnabled = false } = options
  
  const potRef = useRef<HTMLDivElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  
  // Initialize audio context on first interaction (browser requirement)
  useEffect(() => {
    if (audioEnabled && !audioContextRef.current) {
      try {
        audioContextRef.current = new AudioContext()
      } catch (error) {
        console.warn('[useTableAnimations] AudioContext not supported:', error)
      }
    }
  }, [audioEnabled])
  
  // Play a simple beep sound
  const playSound = useCallback((frequency: number, duration: number) => {
    if (!audioEnabled || !audioContextRef.current) return
    
    try {
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.frequency.value = frequency
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch (error) {
      console.warn('[useTableAnimations] Failed to play sound:', error)
    }
  }, [audioEnabled])
  
  // Trigger pot scale/shake animation
  const animatePot = useCallback(() => {
    if (!potRef.current) return
    
    const element = potRef.current
    
    // Add animation class
    element.classList.add('pot-update-animation')
    
    // Remove class after animation completes
    setTimeout(() => {
      element.classList.remove('pot-update-animation')
    }, 500)
  }, [])
  
  // Trigger confetti explosion
  const triggerConfetti = useCallback(() => {
    // Fire confetti from multiple angles
    const count = 200
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    }
    
    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      })
    }
    
    // Burst pattern
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    })
    
    fire(0.2, {
      spread: 60,
    })
    
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    })
    
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    })
    
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    })
  }, [])
  
  // Main delta handler
  const handleDelta = useCallback((delta: TableDeltaMessage) => {
    console.log('[useTableAnimations] Delta received:', delta.type)
    
    // Trigger animations based on delta type
    switch (delta.type) {
      case 'pot_update':
        animatePot()
        playSound(440, 0.1) // A4 note
        break
        
      case 'table_update':
        // Check if hand_result exists in payload (winner declared)
        if (delta.payload?.hand_result) {
          triggerConfetti()
          playSound(523, 0.3) // C5 note, longer duration
        }
        break
        
      case 'action_update':
        // Subtle action sound
        playSound(330, 0.05) // E4 note, very short
        break
        
      default:
        // No animation for other delta types
        break
    }
    
    // Call user's onDelta callback if provided
    userOnDelta?.(delta)
  }, [animatePot, triggerConfetti, playSound, userOnDelta])
  
  return {
    potRef,
    onDelta: handleDelta,
  }
}
