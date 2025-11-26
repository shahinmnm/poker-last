import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
  seatNumber?: number
  positionLabel?: string
  lastAction?: string | null
  isSittingOut?: boolean
  status?: 'active' | 'waiting' | 'seated' | 'sit_out' | 'folded'
  isAllIn?: boolean
}

const sizeMap: Record<NonNullable<PlayerAvatarProps['size']>, number> = {
  sm: 48,
  md: 64,
  lg: 80,
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
  seatNumber,
  positionLabel,
  lastAction,
  isSittingOut = false,
  status = 'active',
  isAllIn = false,
}: PlayerAvatarProps) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState(1)
  const [showPopover, setShowPopover] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const dimension = sizeMap[size]
  const radius = dimension / 2 - 5
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

  // Close popover when clicking outside
  useEffect(() => {
    if (!showPopover) return

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPopover])

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
    if (progress > 0.5) return 'stroke-emerald-400'
    if (progress > 0.2) return 'stroke-amber-400'
    return 'stroke-red-500'
  }, [isActive, progress])

  // Compute status display text
  const statusText = useMemo(() => {
    if (isSittingOut) return t('table.playerStatus.sitOut', { defaultValue: 'SIT OUT' })
    if (status === 'sit_out') return t('table.playerStatus.sitOut', { defaultValue: 'SIT OUT' })
    if (hasFolded && status === 'folded') return t('table.folded', { defaultValue: 'FOLDED' })
    if (status === 'waiting') return t('table.playerStatus.waiting', { defaultValue: 'WAITING' })
    if (status === 'seated') return t('table.playerStatus.seated', { defaultValue: 'SEATED' })
    return null
  }, [hasFolded, isSittingOut, status, t])

  const statusBadgeVariant = useMemo(() => {
    if (isSittingOut || status === 'sit_out') return 'bg-orange-500/90'
    if (hasFolded && status === 'folded') return 'bg-gray-500/90'
    if (status === 'waiting' || status === 'seated') return 'bg-blue-500/90'
    return 'bg-emerald-500/90'
  }, [hasFolded, isSittingOut, status])

  const glowClass = isHero ? 'shadow-[0_0_30px_rgba(56,189,248,0.45)]' : 'shadow-[0_0_18px_rgba(255,255,255,0.08)]'

  return (
    <div className={`relative flex flex-col items-center gap-2 ${className}`} style={{ zIndex: 20 }}>
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#0e1f46] via-[#0b1532] to-[#0a1029] ring-1 ring-white/10 ${glowClass}`}
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
            className="stroke-white/15 fill-transparent"
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
          aria-label={`View ${name} details`}
        >
          <span
            className={`text-white font-bold drop-shadow ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm'}`}
          >
            {initials}
          </span>
        </button>
        {hasFolded && status === 'folded' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <span className="text-white text-[10px] font-semibold">{t('table.folded', { defaultValue: 'FOLD' })}</span>
          </div>
        )}
      </div>

      <div
        className={`min-w-[90px] rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-center backdrop-blur-xl ${
          isHero ? 'ring-1 ring-sky-400/50' : ''
        } ${hasFolded ? 'opacity-50' : ''}`}
      >
        <div className={`text-[13px] font-semibold text-emerald-200 ${size === 'lg' ? 'sm:text-base' : ''}`}>
          {stack.toLocaleString()}
        </div>
        <div className={`truncate text-[11px] font-semibold ${isHero ? 'text-white' : 'text-white/80'}`}>
          {isHero ? t('table.players.youTag', { defaultValue: 'You' }) : name}
        </div>
        {seatNumber !== undefined && (
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/50">
            {t('table.players.seat', { index: (seatNumber ?? 0) + 1 })}
          </div>
        )}
      </div>

      {isAllIn && (
        <div className="px-2 py-0.5 rounded-full bg-rose-500/90 text-black font-black text-[10px] shadow-lg uppercase tracking-wide">
          All In
        </div>
      )}

      {typeof betAmount === 'number' && betAmount > 0 && (
        <div className="px-2.5 py-0.5 rounded-full bg-amber-500/90 text-black font-semibold text-[10px] shadow-lg">
          {t('table.betAmount', { amount: betAmount, defaultValue: `Bet: ${betAmount}` })}
        </div>
      )}

      {/* Glassmorphism Popover */}
      {showPopover && (
        <div
          ref={popoverRef}
          className={`absolute left-1/2 -translate-x-1/2 ${offsetTop ? 'bottom-full mb-2' : 'top-full mt-2'} w-56 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl p-4 space-y-2.5 z-50 transition-all duration-200 ease-out opacity-100 scale-100`}
          onClick={(e) => e.stopPropagation()}
          style={{ animation: 'fadeInScale 200ms ease-out' }}
        >
          {/* Player Name */}
          <div className="text-white font-bold text-base truncate">{name}</div>

          {/* Stack/Chips */}
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-xs">{t('table.fields.stack', { defaultValue: 'Stack' })}</span>
            <span className="text-emerald-400 font-semibold text-sm">{stack.toLocaleString()}</span>
          </div>

          {/* Seat/Position */}
          {(seatNumber !== undefined || positionLabel) && (
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs">{t('table.fields.seat', { defaultValue: 'Seat' })}</span>
              <span className="text-white text-sm font-medium">
                {positionLabel || (seatNumber !== undefined ? `#${seatNumber + 1}` : '-')}
              </span>
            </div>
          )}

          {/* Last Action (if in hand) */}
          {lastAction && (
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-xs">{t('table.playerPopover.lastAction', { defaultValue: 'Last Action' })}</span>
              <span className="text-amber-300 text-xs font-semibold uppercase">{lastAction}</span>
            </div>
          )}

          {/* Status Badge */}
          {statusText && (
            <div className="pt-2 border-t border-white/10">
              <div className={`inline-flex items-center px-2.5 py-1 rounded-full ${statusBadgeVariant} text-white text-[10px] font-bold uppercase tracking-wide`}>
                {statusText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
