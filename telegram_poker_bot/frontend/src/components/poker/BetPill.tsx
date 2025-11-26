import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins } from '@fortawesome/free-solid-svg-icons'
import { pokerTokens } from '@/design/tokens'

export interface BetPillProps {
  amount: number
  className?: string
}

/**
 * BetPill - Displays the current bet amount for a player
 * Positioned closer to the table center in front of the seat
 */
export default function BetPill({ amount, className = '' }: BetPillProps) {
  if (amount <= 0) return null

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${className}`}
      style={{
        background: pokerTokens.colors.states.chip.bg,
        backdropFilter: `blur(${pokerTokens.effects.blur.md})`,
        border: `1px solid ${pokerTokens.colors.border.subtle}`,
        boxShadow: pokerTokens.effects.shadow.surface,
      }}
    >
      <FontAwesomeIcon
        icon={faCoins}
        style={{
          color: '#fbbf24', // amber
          fontSize: pokerTokens.typography.fontSize.xs,
        }}
      />
      <span
        className="font-semibold"
        style={{
          color: pokerTokens.colors.text.high,
          fontSize: pokerTokens.typography.fontSize.sm,
        }}
      >
        {amount.toLocaleString()}
      </span>
    </div>
  )
}
