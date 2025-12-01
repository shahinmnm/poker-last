import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'

interface PlayerCircularTimerProps {
  deadline: string
  totalSeconds: number
  size?: number
  strokeWidth?: number
  className?: string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const interpolateColor = (start: string, end: string, t: number) => {
  const [r1, g1, b1] = [start.slice(1, 3), start.slice(3, 5), start.slice(5, 7)].map((v) =>
    parseInt(v, 16),
  )
  const [r2, g2, b2] = [end.slice(1, 3), end.slice(3, 5), end.slice(5, 7)].map((v) =>
    parseInt(v, 16),
  )
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)

  return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`
}

const computeRemainingSeconds = (deadlineMs: number, totalSeconds: number) => {
  if (!Number.isFinite(deadlineMs) || totalSeconds <= 0) return 0
  const secondsLeft = (deadlineMs - Date.now()) / 1000
  return clamp(secondsLeft, 0, totalSeconds)
}

export default function PlayerCircularTimer({
  deadline,
  totalSeconds,
  size = 80,
  strokeWidth = 6,
  className,
}: PlayerCircularTimerProps) {
  const deadlineMs = useMemo(() => Date.parse(deadline), [deadline])
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const [remaining, setRemaining] = useState<number>(() =>
    computeRemainingSeconds(deadlineMs, totalSeconds),
  )

  useEffect(() => {
    if (!Number.isFinite(deadlineMs) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return
    }

    const update = () => setRemaining(computeRemainingSeconds(deadlineMs, totalSeconds))
    update()

    const intervalId = window.setInterval(update, 120)
    return () => window.clearInterval(intervalId)
  }, [deadlineMs, totalSeconds])

  if (!deadline || !Number.isFinite(deadlineMs) || !Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null
  }

  const fraction = clamp(remaining / totalSeconds, 0, 1)
  const strokeColor = interpolateColor('#3b82f6', '#ef4444', 1 - fraction)
  const dashOffset = circumference * (1 - fraction)
  const center = size / 2

  return (
    <svg
      className={clsx(
        'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        className,
      )}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={0.25}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{
          transition: 'stroke-dashoffset 0.15s linear, stroke 0.15s linear',
          filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.45))',
        }}
      />
    </svg>
  )
}
