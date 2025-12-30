/**
 * useHapticFeedback - Telegram-safe haptic feedback hook
 * 
 * Provides haptic feedback through the Telegram WebApp SDK when available.
 * Safely no-ops when running outside of Telegram or when haptics are unavailable.
 */

type HapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type HapticNotificationType = 'error' | 'success' | 'warning'

interface HapticFeedback {
  /** Trigger impact haptic with specified style */
  impact: (style?: HapticImpactStyle) => void
  /** Trigger notification haptic */
  notification: (type?: HapticNotificationType) => void
  /** Trigger selection changed haptic (lightest) */
  selectionChanged: () => void
  /** Whether haptic feedback is available */
  isAvailable: boolean
}

interface TelegramHapticFeedback {
  impactOccurred: (style: HapticImpactStyle) => void
  notificationOccurred: (type: HapticNotificationType) => void
  selectionChanged: () => void
}

/**
 * Get Telegram WebApp HapticFeedback instance if available
 */
function getTelegramHaptic(): TelegramHapticFeedback | null {
  try {
    // Access through window.Telegram.WebApp which is typed in useTelegram.tsx
    const tg = (window as unknown as { Telegram?: { WebApp?: { HapticFeedback?: TelegramHapticFeedback } } }).Telegram?.WebApp
    if (tg && 'HapticFeedback' in tg && tg.HapticFeedback) {
      return tg.HapticFeedback
    }
  } catch {
    // Silently ignore - not in Telegram context
  }
  return null
}

/**
 * Hook for Telegram-safe haptic feedback
 * 
 * @example
 * const haptic = useHapticFeedback()
 * 
 * // On button press
 * haptic.impact('light')
 * 
 * // On action completion
 * haptic.notification('success')
 */
export function useHapticFeedback(): HapticFeedback {
  const haptic = getTelegramHaptic()
  const isAvailable = haptic !== null

  const impact = (style: HapticImpactStyle = 'light') => {
    try {
      haptic?.impactOccurred(style)
    } catch {
      // Silently ignore errors
    }
  }

  const notification = (type: HapticNotificationType = 'success') => {
    try {
      haptic?.notificationOccurred(type)
    } catch {
      // Silently ignore errors
    }
  }

  const selectionChanged = () => {
    try {
      haptic?.selectionChanged()
    } catch {
      // Silently ignore errors
    }
  }

  return {
    impact,
    notification,
    selectionChanged,
    isAvailable,
  }
}

export default useHapticFeedback

