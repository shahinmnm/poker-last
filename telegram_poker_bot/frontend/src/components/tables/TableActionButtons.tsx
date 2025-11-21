import { useTranslation } from 'react-i18next'
import GlassButton from '../ui/GlassButton'

interface TableActionButtonsProps {
  /** Whether it's the player's turn */
  isPlayerTurn: boolean
  /** Amount to call (0 if no bet to call) */
  amountToCall: number
  /** Minimum raise amount */
  minRaise: number
  /** Player's total stack (for all-in) */
  playerStack: number
  /** Player's current bet in the hand */
  playerBet: number
  /** Whether an action is currently pending */
  actionPending: boolean
  /** Whether the player is sitting out next hand */
  isSittingOut: boolean
  /** Handler for fold action */
  onFold: () => void
  /** Handler for check/call action */
  onCheckCall: () => void
  /** Handler for bet action */
  onBet: () => void
  /** Handler for raise action */
  onRaise: () => void
  /** Handler for all-in action */
  onAllIn: () => void
  /** Handler for sit-out toggle */
  onToggleSitOut: (sitOut: boolean) => void
}

export default function TableActionButtons({
  isPlayerTurn,
  amountToCall,
  actionPending,
  isSittingOut,
  onFold,
  onCheckCall,
  onBet,
  onRaise,
  onAllIn,
  onToggleSitOut,
}: TableActionButtonsProps) {
  const { t } = useTranslation()

  const isDisabled = !isPlayerTurn || actionPending

  return (
    <div className="space-y-2">
      {/* Header - Compact */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-semibold text-[color:var(--text-primary)]">
          {t('table.actions.play')}
        </p>
        <p className="text-[10px] text-[color:var(--text-muted)]">
          {isPlayerTurn ? (
            <span className="text-emerald-400 font-semibold">● {t('table.actions.yourTurn')}</span>
          ) : (
            t('table.actions.wait')
          )}
        </p>
      </div>

      {/* Button Grid - More Compact */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* Fold */}
        <GlassButton
          variant="fold"
          onClick={onFold}
          disabled={isDisabled}
        >
          {t('table.actions.fold')}
        </GlassButton>

        {/* Check or Call */}
        <GlassButton
          variant="check"
          onClick={onCheckCall}
          disabled={isDisabled}
        >
          {amountToCall > 0
            ? t('table.actions.call', { amount: amountToCall })
            : t('table.actions.check')}
        </GlassButton>

        {/* Bet */}
        <GlassButton
          variant="bet"
          onClick={onBet}
          disabled={isDisabled}
        >
          {t('table.actions.bet')}
        </GlassButton>

        {/* Raise */}
        <GlassButton
          variant="raise"
          onClick={onRaise}
          disabled={isDisabled}
        >
          {t('table.actions.raise')}
        </GlassButton>

        {/* All-In - spans both columns */}
        <div className="col-span-2">
          <GlassButton
            variant="allIn"
            onClick={onAllIn}
            disabled={isDisabled}
            fullWidth
          >
            {t('table.actions.allIn')}
          </GlassButton>
        </div>
      </div>

      {/* Sit-Out Toggle */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <button
          onClick={() => onToggleSitOut(!isSittingOut)}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
          style={{
            background: isSittingOut ? 'var(--glass-bg-elevated)' : 'var(--glass-bg)',
            border: `1px solid ${isSittingOut ? 'rgba(251, 146, 60, 0.3)' : 'var(--glass-border)'}`,
            color: isSittingOut ? 'rgb(251, 146, 60)' : 'var(--color-text-primary)',
          }}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span>{isSittingOut ? '✓ ' : ''}{t('table.actions.sitOutNextHand')}</span>
          </div>
        </button>
      </div>
    </div>
  )
}
