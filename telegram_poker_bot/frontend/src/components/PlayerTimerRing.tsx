// telegram_poker_bot/frontend/src/components/PlayerTimerRing.tsx
import { useEffect, useState } from 'react'

/**
 * Props for the PlayerTimerRing component
 */
interface PlayerTimerRingProps {
  /** ISO 8601 timestamp string when the player's turn expires (e.g., "2024-01-15T10:30:00Z") */
  deadline: string | null
  /** Total turn timeout duration in seconds */
  turnTimeoutSeconds: number
  /** Additional CSS classes to apply to the SVG element */
  className?: string
}

// SVG circle parameters
const SIZE = 64
const STROKE_WIDTH = 2

// Timer update and color thresholds
const UPDATE_INTERVAL_MS = 250
const COLOR_YELLOW_THRESHOLD = 0.5  // Switch from green to yellow at 50% remaining
const COLOR_RED_THRESHOLD = 0.25    // Switch from yellow to red at 25% remaining

// Color values (Tailwind colors)
const COLOR_GREEN = '#10b981'  // emerald-500
const COLOR_YELLOW = '#eab308' // yellow-500
const COLOR_RED = '#ef4444'    // red-500

/**
 * A circular timer ring that displays the countdown for a player's turn.
 * 
 * The ring counts down clockwise from 100% to 0%, changing colors based on remaining time:
 * - GREEN: 100% to 50% remaining
 * - YELLOW: 50% to 25% remaining
 * - RED: 25% to 0% remaining
 */
function PlayerTimerRing({ deadline, turnTimeoutSeconds, className = '' }: PlayerTimerRingProps) {
  const [remainingRatio, setRemainingRatio] = useState(1)

  useEffect(() => {
    if (!deadline) {
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const deadlineTime = new Date(deadline).getTime()
      const remaining = Math.max(0, deadlineTime - now)
      const totalMs = turnTimeoutSeconds * 1000
      const ratio = Math.min(1, Math.max(0, remaining / totalMs))
      setRemainingRatio(ratio)
    }

    // Update immediately
    updateTimer()

    // Update periodically for smooth animation
    const interval = setInterval(updateTimer, UPDATE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [deadline, turnTimeoutSeconds])

  if (!deadline) {
    return null
  }

  // Calculate color based on remaining ratio
  let strokeColor: string
  if (remainingRatio > COLOR_YELLOW_THRESHOLD) {
    strokeColor = COLOR_GREEN
  } else if (remainingRatio > COLOR_RED_THRESHOLD) {
    strokeColor = COLOR_YELLOW
  } else {
    strokeColor = COLOR_RED
  }

  const radius = (SIZE - STROKE_WIDTH) / 2
  const circumference = 2 * Math.PI * radius

  // Calculate stroke offset for countdown (clockwise)
  const offset = circumference * (1 - remainingRatio)

  return (
    <svg
      className={`absolute inset-0 pointer-events-none ${className}`}
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Background circle */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={STROKE_WIDTH}
      />
      
      {/* Progress circle */}
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={STROKE_WIDTH}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.1s linear, stroke 0.2s ease',
        }}
      />
    </svg>
  )
}

export default PlayerTimerRing
