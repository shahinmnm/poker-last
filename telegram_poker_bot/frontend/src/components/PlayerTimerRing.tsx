// telegram_poker_bot/frontend/src/components/PlayerTimerRing.tsx
import { useEffect, useState } from 'react'

interface PlayerTimerRingProps {
  deadline: string | null
  turnTimeoutSeconds: number
  className?: string
}

export function PlayerTimerRing({ deadline, turnTimeoutSeconds, className = '' }: PlayerTimerRingProps) {
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

    // Update every 250ms for smooth animation with reasonable CPU usage
    const interval = setInterval(updateTimer, 250)

    return () => clearInterval(interval)
  }, [deadline, turnTimeoutSeconds])

  if (!deadline) {
    return null
  }

  // Calculate color based on remaining ratio
  // GREEN: 100% to 50%
  // YELLOW: 50% to 25%
  // RED: 25% to 0%
  let strokeColor: string
  if (remainingRatio > 0.5) {
    strokeColor = '#10b981' // emerald-500 green
  } else if (remainingRatio > 0.25) {
    strokeColor = '#eab308' // yellow-500
  } else {
    strokeColor = '#ef4444' // red-500
  }

  // SVG circle parameters
  const size = 64
  const strokeWidth = 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Calculate stroke offset for countdown (clockwise)
  const offset = circumference * (1 - remainingRatio)

  return (
    <svg
      className={`absolute inset-0 pointer-events-none ${className}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
      />
      
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
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
