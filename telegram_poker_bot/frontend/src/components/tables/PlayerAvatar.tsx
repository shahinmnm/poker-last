import { useEffect, useMemo, useRef, useState } from 'react'

interface PlayerAvatarProps {
  name: string
  stack: number
  isHero?: boolean
  isActive?: boolean
  hasFolded?: boolean
  betAmount?: number
  deadline?: string | null
  turnTimeoutSeconds?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
  offsetTop?: boolean
}

const sizeMap: Record<NonNullable<PlayerAvatarProps['size']>, number> = {
  sm: 56,
  md: 72,
  lg: 96, // Hero is 20% larger (was 88, now 96 for better visual hierarchy)
}

export default function PlayerAvatar({
  name,
  stack,
  isHero = false,
  isActive = false,
  hasFolded = false,
  betAmount,
  deadline,
  turnTimeoutSeconds = 25,
  size = 'md',
  className = '',
  offsetTop = false,
}: PlayerAvatarProps) {
  const [progress, setProgress] = useState(1)
  const [showPopover, setShowPopover] = useState(false)
  const timerRef = useRef<number | null>(null)
  const dimension = sizeMap[size]
  const radius = dimension / 2 - 6
  const circumference = 2 * Math.PI * radius

  const initials = useMemo(() => {
    const cleaned = name.trim()
    if (!cleaned) return '?'
    return cleaned
      .split(' ')
      .filter((piece) => piece.length > 0)
      .map((piece) => piece[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [name])

  useEffect(() => {
    if (!deadline || !isActive) {
      setProgress(1)
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    const updateProgress = () => {
      const deadlineDate = new Date(deadline)
      const now = Date.now()
      const total = Math.max(turnTimeoutSeconds, 1)
      const remaining = Math.max(0, deadlineDate.getTime() - now)
      const fraction = Math.min(1, Math.max(0, remaining / 1000 / total))
      setProgress(fraction)
    }

    updateProgress()
    timerRef.current = window.setInterval(updateProgress, 200)
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [deadline, isActive, turnTimeoutSeconds])

  const ringColor = useMemo(() => {
    if (!isActive) return 'stroke-transparent'
    // Color transitions: green (>50%) -> amber (20-50%) -> red pulsing (<20%)
    if (progress > 0.5) return 'stroke-emerald-400'
    if (progress > 0.2) return 'stroke-amber-400'
    return 'stroke-red-500 animate-pulse'
  }, [isActive, progress])

  return (
    <div className={`relative flex flex-col items-center gap-2 ${className}`} style={{ zIndex: 20 }}>
      <div
        className={`relative rounded-full bg-gradient-to-br from-blue-900 to-purple-900 flex items-center justify-center overflow-hidden`}
        style={{ width: dimension, height: dimension }}
      >
        <svg
          className="absolute inset-0 -rotate-90"
          viewBox={`0 0 ${dimension} ${dimension}`}
          width={dimension}
          height={dimension}
        >
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            className="stroke-white/10 fill-transparent"
            strokeWidth={3}
          />
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            className={`${ringColor} fill-transparent transition-all duration-300 ease-linear`}
            strokeWidth={3}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
          />
        </svg>
        <button
          type="button"
          className="relative z-10 w-full h-full flex items-center justify-center"
          onClick={() => setShowPopover((prev) => !prev)}
        >
          <span className={`text-white font-bold ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>{initials}</span>
        </button>
        {hasFolded && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white text-xs font-semibold">FOLD</span>
          </div>
        )}
      </div>

      <div className={`rounded-full px-3 py-1 border ${isHero ? 'border-sky-400/60 bg-black/70' : 'border-white/20 bg-black/60'} backdrop-blur-sm min-w-[88px] text-center`}>
        <div className="text-white font-bold text-sm font-mono">{stack}</div>
        <div className={`text-[10px] uppercase tracking-wide ${isHero ? 'text-sky-200' : 'text-gray-300'} truncate max-w-[120px]`}>
          {isHero ? 'You' : name}
        </div>
      </div>

      {typeof betAmount === 'number' && betAmount > 0 && (
        <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/95 backdrop-blur-sm text-black font-bold text-xs shadow-lg border border-amber-300">
          <span className="text-[10px]">💰</span>
          <span>{betAmount}</span>
        </div>
      )}

      {showPopover && (
        <div className={`absolute left-1/2 -translate-x-1/2 ${offsetTop ? '-top-6' : 'top-full'} mt-3 w-48 rounded-2xl bg-black/80 backdrop-blur-lg border border-white/10 shadow-xl p-3 space-y-1 z-30`}>
          <div className="text-white font-semibold">{name}</div>
          <div className="text-sm text-white/70">Stack: {stack.toLocaleString()}</div>
          <div className="text-xs text-white/40">Add Friend (soon)</div>
        </div>
      )}
    </div>
  )
}
