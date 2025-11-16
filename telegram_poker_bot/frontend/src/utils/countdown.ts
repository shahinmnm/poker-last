/**
 * Countdown timer utilities for table expiration
 */

export interface TimeRemaining {
  total: number // milliseconds
  minutes: number
  seconds: number
  isExpired: boolean
  isExpiringSoon: boolean // < 2 minutes
}

/**
 * Calculate time remaining until a target datetime
 */
export function getTimeRemaining(expiresAt: string | null): TimeRemaining {
  if (!expiresAt) {
    return {
      total: Infinity,
      minutes: 999,
      seconds: 59,
      isExpired: false,
      isExpiringSoon: false,
    }
  }

  const now = Date.now()
  const target = new Date(expiresAt).getTime()
  const total = target - now

  if (total <= 0) {
    return {
      total: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      isExpiringSoon: false,
    }
  }

  const minutes = Math.floor((total / 1000 / 60) % 60)
  const seconds = Math.floor((total / 1000) % 60)
  const isExpiringSoon = total < 2 * 60 * 1000 // less than 2 minutes

  return {
    total,
    minutes,
    seconds,
    isExpired: false,
    isExpiringSoon,
  }
}

/**
 * Format time remaining as MM:SS
 */
export function formatTimeRemaining(timeRemaining: TimeRemaining): string {
  if (timeRemaining.isExpired) {
    return '0:00'
  }

  if (timeRemaining.total === Infinity) {
    return '∞'
  }

  const mm = String(timeRemaining.minutes).padStart(2, '0')
  const ss = String(timeRemaining.seconds).padStart(2, '0')
  return `${mm}:${ss}`
}

/**
 * Format time remaining as compact version (M:SS or MM:SS)
 */
export function formatTimeRemainingCompact(timeRemaining: TimeRemaining): string {
  if (timeRemaining.isExpired) {
    return '0:00'
  }

  if (timeRemaining.total === Infinity) {
    return '∞'
  }

  const m = timeRemaining.minutes
  const ss = String(timeRemaining.seconds).padStart(2, '0')
  return `${m}:${ss}`
}
