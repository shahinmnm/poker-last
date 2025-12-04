/**
 * Phase 5: CircularTimer Component
 * 
 * Timer synced to action_deadline from backend.
 * No client-side guessing.
 */

import { useEffect, useState, useMemo } from 'react'

interface CircularTimerProps {
  deadline: number | null // epoch ms
  totalDuration?: number // seconds (for display reference)
  size?: number // pixels
  strokeWidth?: number
  className?: string
}

export function CircularTimer({
  deadline,
  totalDuration = 30,
  size = 60,
  strokeWidth = 4,
  className = '',
}: CircularTimerProps) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    if (!deadline) {
      setRemainingMs(null)
      return
    }

    const updateTimer = () => {
      const now = Date.now()
      const remaining = deadline - now
      setRemainingMs(Math.max(0, remaining))
    }

    // Initial update
    updateTimer()

    // Update every 100ms for smooth animation
    const interval = setInterval(updateTimer, 100)

    return () => clearInterval(interval)
  }, [deadline])

  const progress = useMemo(() => {
    if (remainingMs === null) return 0
    const totalMs = totalDuration * 1000
    return Math.min(1, Math.max(0, remainingMs / totalMs))
  }, [remainingMs, totalDuration])

  const seconds = useMemo(() => {
    if (remainingMs === null) return 0
    return Math.ceil(remainingMs / 1000)
  }, [remainingMs])

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  // Color based on remaining time
  const strokeColor = useMemo(() => {
    if (progress > 0.5) return '#10b981' // green
    if (progress > 0.25) return '#f59e0b' // amber
    return '#ef4444' // red
  }, [progress])

  // Pulse animation when time is running out
  const shouldPulse = progress < 0.25 && progress > 0

  if (!deadline || remainingMs === null) {
    return null
  }

  return (
    <div
      className={`circular-timer ${shouldPulse ? 'animate-pulse' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#374151"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.1s linear, stroke 0.3s ease',
          }}
        />
      </svg>
      
      {/* Centered seconds display */}
      <div
        className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white"
        style={{ fontSize: size / 4 }}
      >
        {seconds}
      </div>
    </div>
  )
}

export default CircularTimer
