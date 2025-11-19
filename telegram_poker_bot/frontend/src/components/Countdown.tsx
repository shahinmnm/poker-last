import { useEffect, useState } from 'react'
import { getTimeRemaining, formatTimeRemainingCompact, type TimeRemaining } from '../utils/countdown'

interface CountdownProps {
  expiresAt: string | null
  className?: string
  onExpire?: () => void
}

export function Countdown({ expiresAt, className, onExpire }: CountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>(() => getTimeRemaining(expiresAt))

  useEffect(() => {
    if (!expiresAt) {
      return
    }

    const update = () => {
      const remaining = getTimeRemaining(expiresAt)
      setTimeRemaining(remaining)

      if (remaining.isExpired && onExpire) {
        onExpire()
      }
    }

    // Update immediately
    update()

    // Update every second
    const interval = setInterval(update, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, onExpire])

  if (timeRemaining.total === Infinity) {
    return null
  }

  if (timeRemaining.isExpired) {
    return <span className={className}>Expired</span>
  }

  return <span className={className}>{formatTimeRemainingCompact(timeRemaining)}</span>
}

export default Countdown
