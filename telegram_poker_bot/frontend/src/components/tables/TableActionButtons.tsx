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
}

export default function TableActionButtons({
  isPlayerTurn,
  amountToCall,
  actionPending,
  onFold,
  onCheckCall,
  onBet,
  onRaise,
  onAllIn,
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

      {/* Sit-Out Toggle - Disabled Stub */}
      <div className="mt-3 pt-3 border-t border-white/10">
        <button
          disabled
          aria-disabled="true"
          className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity opacity-50 cursor-not-allowed"
          style={{
            background: 'var(--glass-bg-elevated)',
            border: '1px solid var(--glass-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <span>{t('table.actions.sitOutNextHand')}</span>
            <span className="text-[10px] opacity-70">{t('common.comingSoon')}</span>
          </div>
        </button>
      </div>
    </div>
  )
}
