import { pokerTokens } from '@/design/tokens'

export interface Pot {
  amount: number
  label?: string
}

export interface PotDisplayProps {
  mainPot: number
  sidePots?: Pot[]
  className?: string
}

/**
 * PotDisplay - Shows the main pot and optional side pots
 * Uses orange/red gradient background with prominent text
 */
export default function PotDisplay({ mainPot, sidePots = [], className = '' }: PotDisplayProps) {
  const totalPot = mainPot + sidePots.reduce((sum, pot) => sum + pot.amount, 0)

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      {/* Main pot */}
      <div
        className="rounded-full px-6 py-2 animate-pot-grow"
        style={{
          background: pokerTokens.colors.pot.bg,
          border: `1px solid ${pokerTokens.colors.pot.border}`,
          boxShadow: `${pokerTokens.effects.shadow.glow.cta}, ${pokerTokens.effects.shadow.surface}`,
        }}
      >
        <div className="flex flex-col items-center">
          <span
            className="font-semibold uppercase tracking-wider opacity-90"
            style={{
              fontSize: pokerTokens.typography.fontSize.xs,
              color: pokerTokens.colors.pot.text,
            }}
          >
            Pot
          </span>
          <span
            className="font-bold"
            style={{
              fontSize: pokerTokens.typography.fontSize.lg,
              color: pokerTokens.colors.pot.text,
            }}
          >
            {totalPot.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Side pots */}
      {sidePots.length > 0 && (
        <div className="flex flex-col items-center gap-0.5">
          {sidePots.map((pot, index) => (
            <div
              key={index}
              className="rounded-full px-4 py-1"
              style={{
                background: 'rgba(249, 115, 22, 0.3)',
                backdropFilter: `blur(${pokerTokens.effects.blur.sm})`,
                border: '1px solid rgba(249, 115, 22, 0.2)',
              }}
            >
              <span
                className="font-medium"
                style={{
                  fontSize: pokerTokens.typography.fontSize.xs,
                  color: pokerTokens.colors.text.high,
                }}
              >
                {pot.label || `Side Pot ${index + 1}`}: {pot.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
