// telegram_poker_bot/frontend/src/components/PlayerRectTimer.tsx
import { useEffect, useState, useRef, useLayoutEffect } from 'react'

/**
 * Props for the PlayerRectTimer component
 */
interface PlayerRectTimerProps {
  /** ISO 8601 timestamp string when the player's turn expires (e.g., "2024-01-15T10:30:00Z") */
  deadline: string | null
  /** Total turn timeout duration in seconds */
  turnTimeoutSeconds: number
  /** Additional CSS classes to apply to the overlay */
  className?: string
}

// Timer update and color thresholds
const UPDATE_INTERVAL_MS = 100
const COLOR_YELLOW_THRESHOLD = 0.5  // Switch from green to yellow at 50% remaining
const COLOR_RED_THRESHOLD = 0.25    // Switch from yellow to red at 25% remaining

// Color values (Tailwind colors)
const COLOR_GREEN = '#10b981'  // emerald-500
const COLOR_YELLOW = '#eab308' // yellow-500
const COLOR_RED = '#ef4444'    // red-500

// Stroke width for the progress border
const STROKE_WIDTH = 2
const TRACK_COLOR = 'rgba(255, 255, 255, 0.28)'

// Transition durations for smooth animations
const PROGRESS_TRANSITION_MS = 180  // Stroke offset animation speed
const COLOR_TRANSITION_MS = 200     // Color change animation speed

/**
 * A rounded-rectangle timer border that displays the countdown for a player's turn.
 * 
 * The border counts down clockwise from 100% to 0%, changing colors based on remaining time:
 * - GREEN: 100% to 50% remaining
 * - YELLOW: 50% to 25% remaining
 * - RED: 25% to 0% remaining
 * 
 * The progress starts at the top-middle of the rectangle and shrinks clockwise.
 */
function PlayerRectTimer({ deadline, turnTimeoutSeconds, className = '' }: PlayerRectTimerProps) {
  const [remainingRatio, setRemainingRatio] = useState(1)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [borderRadius, setBorderRadius] = useState(12)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rectRef = useRef<SVGRectElement | null>(null)
  const [perimeter, setPerimeter] = useState(0)

  // Measure container dimensions
  useLayoutEffect(() => {
    if (!containerRef.current) return

    const updateDimensions = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setDimensions({ width: rect.width, height: rect.height })

      const computedRadius = window.getComputedStyle(containerRef.current).borderRadius
      const parsedRadius = Number.parseFloat(computedRadius)
      if (!Number.isNaN(parsedRadius)) {
        setBorderRadius(parsedRadius)
      }
    }

    updateDimensions()

    // Update on resize
    const resizeObserver = new ResizeObserver(updateDimensions)
    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  // Calculate perimeter after rect is rendered
  useLayoutEffect(() => {
    if (!rectRef.current) return
    
    try {
      const length = rectRef.current.getTotalLength()
      setPerimeter(length)
    } catch (e) {
      // Fallback: approximate perimeter
      // For rounded rect: perimeter ≈ 2 * (w + h) - 8r + 2πr
      // where r is radius. For rounded-lg (0.75rem = 12px), use that as approximation
      const r = borderRadius
      const approxPerimeter = 2 * (dimensions.width + dimensions.height - 4 * r) + 2 * Math.PI * r
      setPerimeter(approxPerimeter)
    }
  }, [borderRadius, dimensions.width, dimensions.height])

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

  if (!deadline || dimensions.width === 0 || dimensions.height === 0) {
    return <div ref={containerRef} className={`absolute inset-0 pointer-events-none ${className}`} />
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

  const { width, height } = dimensions
  const radius = borderRadius
  
  const dashOffset = Math.min(perimeter, Math.max(0, (1 - remainingRatio) * perimeter))

  return (
    <div ref={containerRef} className={`absolute inset-0 pointer-events-none ${className}`}>
      <svg
        className="absolute inset-0"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        <rect
          x={STROKE_WIDTH / 2}
          y={STROKE_WIDTH / 2}
          width={width - STROKE_WIDTH}
          height={height - STROKE_WIDTH}
          rx={radius}
          ry={radius}
          fill="none"
          stroke={TRACK_COLOR}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.65}
        />
        <rect
          ref={rectRef}
          x={STROKE_WIDTH / 2}
          y={STROKE_WIDTH / 2}
          width={width - STROKE_WIDTH}
          height={height - STROKE_WIDTH}
          rx={radius}
          ry={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${perimeter} ${perimeter}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${width / 2} ${height / 2})`}
          style={{
            transition: `stroke-dashoffset ${PROGRESS_TRANSITION_MS}ms linear, stroke ${COLOR_TRANSITION_MS}ms ease`,
          }}
        />
      </svg>
    </div>
  )
}

export default PlayerRectTimer
