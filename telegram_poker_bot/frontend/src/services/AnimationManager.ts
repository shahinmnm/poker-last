/**
 * Phase 5: Animation Framework
 * 
 * Handles all table animations:
 * - Card slide/flip
 * - Bet movement
 * - Pot collection
 * - Win highlight
 * - Timeout pulse
 * 
 * All animations are cancellable on reconnect/desync.
 */

import { useCallback, useRef, useEffect } from 'react'
import type { AnimationType, AnimationEvent } from '../types/normalized'

interface AnimationManagerOptions {
  onAnimationComplete?: (id: string) => void
}

export class AnimationManager {
  private animations = new Map<string, AnimationEvent>()
  private callbacks = new Map<string, () => void>()
  private onComplete?: (id: string) => void

  constructor(options: AnimationManagerOptions = {}) {
    this.onComplete = options.onAnimationComplete
  }

  /**
   * Start an animation
   */
  start(event: AnimationEvent): void {
    const { id, duration } = event
    
    // Cancel existing animation with same ID
    this.cancel(id)
    
    // Store animation
    this.animations.set(id, event)
    
    // Apply animation based on type
    this.applyAnimation(event)
    
    // Auto-complete after duration
    const timeout = setTimeout(() => {
      this.complete(id)
    }, duration)
    
    this.callbacks.set(id, () => clearTimeout(timeout))
  }

  /**
   * Cancel an animation
   */
  cancel(id: string): void {
    const callback = this.callbacks.get(id)
    if (callback) {
      callback()
      this.callbacks.delete(id)
    }
    
    const event = this.animations.get(id)
    if (event) {
      this.removeAnimation(event)
      this.animations.delete(id)
    }
  }

  /**
   * Cancel all animations
   */
  cancelAll(): void {
    const ids = Array.from(this.animations.keys())
    ids.forEach((id) => this.cancel(id))
  }

  /**
   * Complete an animation
   */
  private complete(id: string): void {
    const event = this.animations.get(id)
    if (event) {
      this.removeAnimation(event)
      this.animations.delete(id)
      this.callbacks.delete(id)
      this.onComplete?.(id)
    }
  }

  /**
   * Apply animation based on type
   */
  private applyAnimation(event: AnimationEvent): void {
    switch (event.type) {
      case 'card_slide':
        this.animateCardSlide(event)
        break
      case 'card_flip':
        this.animateCardFlip(event)
        break
      case 'bet_movement':
        this.animateBetMovement(event)
        break
      case 'pot_collection':
        this.animatePotCollection(event)
        break
      case 'win_highlight':
        this.animateWinHighlight(event)
        break
      case 'timeout_pulse':
        this.animateTimeoutPulse(event)
        break
    }
  }

  /**
   * Remove animation effects
   */
  private removeAnimation(event: AnimationEvent): void {
    const element = document.querySelector(`[data-animation-id="${event.id}"]`)
    if (element) {
      element.removeAttribute('data-animation-id')
      element.classList.remove('animating')
    }
  }

  /**
   * Card slide animation
   */
  private animateCardSlide(event: AnimationEvent): void {
    const element = document.querySelector(`[data-target="${event.target}"]`)
    if (!element) return

    element.setAttribute('data-animation-id', event.id)
    element.classList.add('animating', 'animate-card-slide')
    
    if (event.from && event.to) {
      const deltaX = event.to.x - event.from.x
      const deltaY = event.to.y - event.from.y
      
      ;(element as HTMLElement).style.setProperty('--slide-x', `${deltaX}px`)
      ;(element as HTMLElement).style.setProperty('--slide-y', `${deltaY}px`)
    }
  }

  /**
   * Card flip animation
   */
  private animateCardFlip(event: AnimationEvent): void {
    const element = document.querySelector(`[data-target="${event.target}"]`)
    if (!element) return

    element.setAttribute('data-animation-id', event.id)
    element.classList.add('animating', 'animate-card-flip')
  }

  /**
   * Bet movement animation
   */
  private animateBetMovement(event: AnimationEvent): void {
    const element = document.querySelector(`[data-target="${event.target}"]`)
    if (!element) return

    element.setAttribute('data-animation-id', event.id)
    element.classList.add('animating', 'animate-bet-movement')
  }

  /**
   * Pot collection animation
   */
  private animatePotCollection(event: AnimationEvent): void {
    const element = document.querySelector(`[data-target="${event.target}"]`)
    if (!element) return

    element.setAttribute('data-animation-id', event.id)
    element.classList.add('animating', 'animate-pot-collection')
  }

  /**
   * Win highlight animation
   */
  private animateWinHighlight(event: AnimationEvent): void {
    const element = document.querySelector(`[data-target="${event.target}"]`)
    if (!element) return

    element.setAttribute('data-animation-id', event.id)
    element.classList.add('animating', 'animate-win-highlight')
  }

  /**
   * Timeout pulse animation
   */
  private animateTimeoutPulse(event: AnimationEvent): void {
    const element = document.querySelector(`[data-target="${event.target}"]`)
    if (!element) return

    element.setAttribute('data-animation-id', event.id)
    element.classList.add('animating', 'animate-timeout-pulse')
  }
}

/**
 * React hook for using animation manager
 */
export function useAnimations(options: AnimationManagerOptions = {}) {
  const managerRef = useRef<AnimationManager | null>(null)

  useEffect(() => {
    managerRef.current = new AnimationManager(options)

    return () => {
      managerRef.current?.cancelAll()
      managerRef.current = null
    }
  }, [options])

  const startAnimation = useCallback((event: AnimationEvent) => {
    managerRef.current?.start(event)
  }, [])

  const cancelAnimation = useCallback((id: string) => {
    managerRef.current?.cancel(id)
  }, [])

  const cancelAllAnimations = useCallback(() => {
    managerRef.current?.cancelAll()
  }, [])

  return {
    startAnimation,
    cancelAnimation,
    cancelAllAnimations,
  }
}

/**
 * Helper to create animation events
 */
export function createAnimationEvent(
  type: AnimationType,
  target: string,
  duration: number,
  options: Partial<AnimationEvent> = {}
): AnimationEvent {
  return {
    id: `${type}-${target}-${Date.now()}`,
    type,
    target,
    duration,
    ...options,
  }
}
