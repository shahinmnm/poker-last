import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useClickOutside } from '../../hooks/useClickOutside'

export interface Player {
  id: string
  username: string
  initials: string
  avatarUrl?: string
  chips: number
  lastAction?: string
  status: 'WAITING' | 'ACTIVE' | 'FOLDED' | 'ALL_IN' | 'OUT'
  isDealer: boolean
  isCurrentTurn: boolean
  turnProgress?: number // 0..1
  isWinner?: boolean
}

export interface PlayerAvatarHUDProps {
  player: Player
  /** Position hint for info panel placement */
  positionHint?: 'top' | 'bottom' | 'left' | 'right'
  /** Optional className for the container */
  className?: string
}

/**
 * PlayerAvatarHUD - Compact avatar with expandable info panel
 * 
 * Features:
 * - Smaller avatar size (~48-56px diameter)
 * - Circular timer ring for turn indication
 * - Tap to open floating glass info panel
 * - Click outside to close
 * - Turn pulse animation
 * - Dealer/winner indicators
 */
export default function PlayerAvatarHUD({
  player,
  positionHint = 'top',
  className = '',
}: PlayerAvatarHUDProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close panel when clicking outside
  useClickOutside(containerRef, () => {
    if (isOpen) setIsOpen(false)
  })

  const avatarSize = 52 // pixels
  const strokeWidth = 3
  const radius = (avatarSize - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const progress = player.turnProgress ?? 0
  const strokeDashoffset = circumference * (1 - progress)

  // Determine ring color based on turn progress
  const ringColor = useMemo(() => {
    if (!player.isCurrentTurn) return 'transparent'
    if (progress > 0.5) return '#34d399' // emerald-400
    if (progress > 0.2) return '#fbbf24' // amber-400
    return '#ef4444' // red-500
  }, [player.isCurrentTurn, progress])

  // Determine glow color for special states
  const glowColor = useMemo(() => {
    if (player.isWinner) return 'rgba(251, 191, 36, 0.7)' // gold
    if (player.isDealer) return 'rgba(59, 130, 246, 0.7)' // blue
    if (player.isCurrentTurn) return 'rgba(52, 211, 153, 0.7)' // emerald
    return 'transparent'
  }, [player.isWinner, player.isDealer, player.isCurrentTurn])

  // Info panel positioning classes
  const panelPositionClasses = useMemo(() => {
    switch (positionHint) {
      case 'top':
        return 'bottom-full mb-3 left-1/2 -translate-x-1/2'
      case 'bottom':
        return 'top-full mt-3 left-1/2 -translate-x-1/2'
      case 'left':
        return 'right-full mr-3 top-1/2 -translate-y-1/2'
      case 'right':
        return 'left-full ml-3 top-1/2 -translate-y-1/2'
      default:
        return 'bottom-full mb-3 left-1/2 -translate-x-1/2'
    }
  }, [positionHint])

  // Format chips with locale-aware formatting
  const formattedChips = player.chips.toLocaleString()

  // Get status display text
  const statusText = useMemo(() => {
    if (player.lastAction) return player.lastAction
    switch (player.status) {
      case 'WAITING':
        return 'Waiting'
      case 'ACTIVE':
        return 'Active'
      case 'FOLDED':
        return 'Folded'
      case 'ALL_IN':
        return 'All-in'
      case 'OUT':
        return 'Out'
      default:
        return ''
    }
  }, [player.status, player.lastAction])

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Avatar with Timer Ring */}
      <motion.div
        className="relative"
        animate={
          player.isCurrentTurn
            ? {
                scale: [1, 1.05, 1],
                opacity: [1, 0.9, 1],
              }
            : {}
        }
        transition={{
          duration: 2,
          repeat: player.isCurrentTurn ? Infinity : 0,
          ease: 'easeInOut',
        }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative focus:outline-none"
          style={{ width: avatarSize, height: avatarSize }}
        >
          {/* Outer glow for special states */}
          {glowColor !== 'transparent' && (
            <div
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: `0 0 20px ${glowColor}`,
              }}
            />
          )}

          {/* SVG Timer Ring */}
          <svg
            className="absolute inset-0 -rotate-90"
            width={avatarSize}
            height={avatarSize}
          >
            {/* Background circle */}
            <circle
              cx={avatarSize / 2}
              cy={avatarSize / 2}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
              cx={avatarSize / 2}
              cy={avatarSize / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-200"
            />
          </svg>

          {/* Avatar Circle */}
          <div
            className="absolute inset-0 rounded-full bg-slate-900/80 border border-white/10 flex items-center justify-center overflow-hidden"
            style={{ margin: strokeWidth }}
          >
            {player.avatarUrl ? (
              <img
                src={player.avatarUrl}
                alt={player.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-sm">
                {player.initials}
              </span>
            )}

            {/* Folded overlay */}
            {player.status === 'FOLDED' && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white text-[8px] font-semibold">
                  FOLD
                </span>
              </div>
            )}
          </div>

          {/* Dealer/Winner badge */}
          {(player.isDealer || player.isWinner) && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 border border-white/20 flex items-center justify-center shadow-lg">
              <span className="text-[8px] font-bold text-slate-900">
                {player.isWinner ? '👑' : 'D'}
              </span>
            </div>
          )}
        </button>
      </motion.div>

      {/* Info Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={`absolute ${panelPositionClasses} z-50 w-48`}
            initial={{
              opacity: 0,
              scale: 0.9,
              x:
                positionHint === 'left'
                  ? 10
                  : positionHint === 'right'
                  ? -10
                  : 0,
              y:
                positionHint === 'top'
                  ? 10
                  : positionHint === 'bottom'
                  ? -10
                  : 0,
            }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              x:
                positionHint === 'left'
                  ? 5
                  : positionHint === 'right'
                  ? -5
                  : 0,
              y: positionHint === 'top' ? 5 : positionHint === 'bottom' ? -5 : 0,
            }}
            transition={{
              duration: 0.25,
              ease: [0.175, 0.885, 0.32, 1.275], // ease-out-back
            }}
          >
            <div
              className="bg-slate-800/40 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-3"
              style={{
                boxShadow: '0 20px 60px rgba(0,0,0,0.75)',
              }}
            >
              {/* Username */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/80 mb-1">
                  Player
                </div>
                <div className="text-sm text-white font-medium truncate">
                  {player.username}
                </div>
              </div>

              {/* Chips */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/80 mb-1">
                  Chips
                </div>
                <div className="font-mono text-xs text-emerald-200">
                  {formattedChips}
                </div>
              </div>

              {/* Status / Last Action */}
              {statusText && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/80 mb-1">
                    Status
                  </div>
                  <div className="text-xs text-white/90">{statusText}</div>
                </div>
              )}

              {/* Turn Progress (when active) */}
              {player.isCurrentTurn && typeof player.turnProgress === 'number' && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-slate-300/80 mb-1">
                    Time Remaining
                  </div>
                  <div className="relative h-1 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-200"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
