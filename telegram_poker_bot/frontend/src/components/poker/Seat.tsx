import { ReactNode, useMemo } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUserPlus } from '@fortawesome/free-solid-svg-icons'
import { pokerTokens } from '@/design/tokens'

export type SeatVariant = 'hero' | 'active' | 'waiting' | 'folded' | 'empty' | 'offline'

export interface SeatProps {
  variant: SeatVariant
  name?: string
  avatar?: string
  chipStack?: number
  seatNumber?: number
  positionLabel?: string
  statusPill?: 'FOLD' | 'ALL-IN' | 'SITTING OUT' | 'OFFLINE'
  isMyTurn?: boolean
  size?: 'mobile' | 'desktop'
  onClick?: () => void
  className?: string
  children?: ReactNode
}

/**
 * Seat component - A reusable poker seat with multiple variants
 * Supports hero, active, waiting, folded, empty, and offline states
 */
export default function Seat({
  variant,
  name,
  avatar,
  chipStack,
  seatNumber,
  positionLabel,
  statusPill,
  isMyTurn = false,
  size = 'mobile',
  onClick,
  className = '',
  children,
}: SeatProps) {
  const avatarSize = size === 'desktop' 
    ? (variant === 'hero' ? pokerTokens.layout.seatSize.desktop.hero : pokerTokens.layout.seatSize.desktop.avatar)
    : (variant === 'hero' ? pokerTokens.layout.seatSize.mobile.hero : pokerTokens.layout.seatSize.mobile.avatar)

  // Calculate initials before any conditional returns
  const initials = useMemo(() => {
    if (!name) return '?'
    return name
      .trim()
      .split(' ')
      .filter((w) => w.length > 0)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [name])

  // Determine seat styles based on variant
  const seatStyles = useMemo(() => {
    const baseStyles = {
      background: pokerTokens.colors.glass.seat,
      backdropFilter: `blur(${pokerTokens.effects.blur.lg})`,
      border: `1px solid ${pokerTokens.colors.border.subtle}`,
      boxShadow: pokerTokens.effects.shadow.seat,
    }

    switch (variant) {
      case 'hero':
        return {
          ...baseStyles,
          border: '2px solid transparent',
          backgroundImage: `${pokerTokens.colors.states.hero.borderGradient}, ${baseStyles.background}`,
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
          boxShadow: `${pokerTokens.effects.shadow.glow.primary}, ${baseStyles.boxShadow}`,
          transform: 'scale(1.05)',
        }

      case 'active':
        return {
          ...baseStyles,
          transform: isMyTurn ? 'scale(1.05)' : 'scale(1)',
        }

      case 'folded':
        return {
          ...baseStyles,
          opacity: 0.45,
          border: `1px solid ${pokerTokens.colors.states.folded.border}`,
          filter: 'grayscale(1)',
        }

      case 'empty':
        return {
          background: pokerTokens.colors.glass.card,
          backdropFilter: `blur(${pokerTokens.effects.blur.xl})`,
          border: `2px dashed ${pokerTokens.colors.states.empty.border}`,
          boxShadow: 'none',
        }

      case 'offline':
        return {
          ...baseStyles,
          opacity: 0.5,
          filter: 'grayscale(0.8)',
        }

      default:
        return baseStyles
    }
  }, [variant, isMyTurn])

  // Empty seat rendering
  if (variant === 'empty') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group flex flex-col items-center gap-2 rounded-full p-4 transition-all duration-300 hover:scale-105 animate-empty-seat-pulse ${className}`}
        style={seatStyles}
      >
        <div
          className="flex items-center justify-center rounded-full bg-white/5"
          style={{
            width: avatarSize,
            height: avatarSize,
          }}
        >
          <FontAwesomeIcon
            icon={faUserPlus}
            className="text-cyan-200"
            style={{ fontSize: avatarSize * 0.4 }}
          />
        </div>
        <div className="text-center">
          <p
            className="font-semibold uppercase tracking-wider"
            style={{
              fontSize: pokerTokens.typography.fontSize.xs,
              color: pokerTokens.colors.text.medium,
            }}
          >
            {/* Display as 1-based for user-facing text, while internal logic uses 0-based */}
            {seatNumber !== undefined ? `Seat ${seatNumber + 1}` : 'Seat Open'}
          </p>
        </div>
      </button>
    )
  }

  return (
    <div
      className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 transition-all duration-300 animate-seat-enter ${className}`}
      style={seatStyles}
      onClick={onClick}
    >
      {/* Turn ring for active player */}
      {isMyTurn && variant === 'active' && (
        <div
          className="absolute inset-0 rounded-2xl animate-turn-ring"
          style={{
            background: pokerTokens.colors.states.active.ringGradient,
            padding: '3px',
            zIndex: -1,
          }}
        />
      )}

      {/* Position label (BTN, SB, BB) */}
      {positionLabel && (
        <div
          className="absolute -top-2 -right-2 rounded-full px-2 py-0.5 font-bold"
          style={{
            background: pokerTokens.colors.primary.base,
            color: pokerTokens.colors.text.high,
            fontSize: pokerTokens.typography.fontSize.xs,
            boxShadow: pokerTokens.effects.shadow.surface,
          }}
        >
          {positionLabel}
        </div>
      )}

      {/* Status pill */}
      {statusPill && (
        <div
          className="absolute -top-2 -left-2 rounded-full px-2 py-0.5 font-semibold uppercase"
          style={{
            background: statusPill === 'FOLD' 
              ? pokerTokens.colors.danger.base 
              : statusPill === 'ALL-IN'
              ? pokerTokens.colors.cta.base
              : pokerTokens.colors.text.muted,
            color: pokerTokens.colors.text.high,
            fontSize: pokerTokens.typography.fontSize.xs,
            boxShadow: pokerTokens.effects.shadow.surface,
          }}
        >
          {statusPill}
        </div>
      )}

      {/* Avatar */}
      <div
        className="relative overflow-hidden rounded-full"
        style={{
          width: avatarSize,
          height: avatarSize,
          border: `2px solid ${pokerTokens.colors.border.normal}`,
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={name || 'Player'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-bold"
            style={{
              background: pokerTokens.colors.primary.base,
              color: pokerTokens.colors.text.high,
              fontSize: avatarSize * 0.4,
            }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Player name */}
      <div className="text-center">
        <p
          className="font-semibold"
          style={{
            fontSize: pokerTokens.typography.fontSize.sm,
            color: pokerTokens.colors.text.high,
          }}
        >
          {name || 'Player'}
        </p>
        
        {/* Hero label */}
        {variant === 'hero' && (
          <p
            className="mt-0.5 font-bold uppercase tracking-wider"
            style={{
              fontSize: pokerTokens.typography.fontSize.xs,
              color: pokerTokens.colors.primary.light,
            }}
          >
            YOU
          </p>
        )}

        {/* Chip stack */}
        {chipStack !== undefined && (
          <p
            className="mt-1 font-medium"
            style={{
              fontSize: pokerTokens.typography.fontSize.sm,
              color: '#06b6d4', // cyan
            }}
          >
            {chipStack.toLocaleString()}
          </p>
        )}
      </div>

      {/* Additional children (e.g., cards, bet amount) */}
      {children}
    </div>
  )
}
