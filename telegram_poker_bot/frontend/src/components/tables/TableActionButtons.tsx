import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GlassButton from '../ui/GlassButton'
import BetRaiseModal from './BetRaiseModal'

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
  /** Whether sit-out toggle is pending */
  isSitOutPending?: boolean
  /** Current pot total for presets */
  currentPot?: number
  /** Maximum raise amount */
  maxRaise?: number
  /** Handler for fold action */
  onFold: () => void
  /** Handler for check/call action */
  onCheckCall: () => void
  /** Handler for bet action with amount */
  onBet: (amount: number) => void
  /** Handler for raise action with amount */
  onRaise: (amount: number) => void
  /** Handler for all-in action */
  onAllIn: () => void
  /** Handler for sit-out toggle */
  onToggleSitOut: (sitOut: boolean) => void
}

export default function TableActionButtons({
  isPlayerTurn,
  amountToCall,
  minRaise,
  playerStack,
  playerBet,
  actionPending,
  isSittingOut,
  isSitOutPending = false,
  currentPot = 0,
  maxRaise,
  onFold,
  onCheckCall,
  onBet,
  onRaise,
  onAllIn,
  onToggleSitOut,
}: TableActionButtonsProps) {
  const { t } = useTranslation()
  const [showBetModal, setShowBetModal] = useState(false)
  const [showRaiseModal, setShowRaiseModal] = useState(false)

  const isDisabled = !isPlayerTurn || actionPending

  const canBet = amountToCall === 0
  const canRaise = amountToCall > 0

  const effectiveMaxRaise = maxRaise ?? (playerStack + playerBet)

  return (
    <div className="space-y-2">
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

      <div className="grid grid-cols-2 gap-1.5">
        <GlassButton
          variant="fold"
          onClick={onFold}
          disabled={isDisabled}
        >
          {t('table.actions.fold')}
        </GlassButton>

        <GlassButton
          variant="check"
          onClick={onCheckCall}
          disabled={isDisabled}
        >
          {amountToCall > 0
            ? t('table.actions.call', { amount: amountToCall })
            : t('table.actions.check')}
        </GlassButton>

        {canBet && (
          <GlassButton
            variant="bet"
            onClick={() => setShowBetModal(true)}
            disabled={isDisabled}
          >
            {t('table.actions.bet')}
          </GlassButton>
        )}

        {canRaise && (
          <GlassButton
            variant="raise"
            onClick={() => setShowRaiseModal(true)}
            disabled={isDisabled}
          >
            {t('table.actions.raise')}
          </GlassButton>
        )}

        <div className={canBet || canRaise ? '' : 'col-span-2'}>
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

      <div className="mt-3 pt-3 border-t border-white/10">
        <button
          onClick={() => onToggleSitOut(!isSittingOut)}
          disabled={isSitOutPending}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-all"
          style={{
            background: isSittingOut ? 'var(--glass-bg-elevated)' : 'var(--glass-bg)',
            border: `1px solid ${isSittingOut ? 'rgba(251, 146, 60, 0.3)' : 'var(--glass-border)'}`,
            color: isSittingOut ? 'rgb(251, 146, 60)' : 'var(--color-text-primary)',
            opacity: isSitOutPending ? 0.6 : 1,
            cursor: isSitOutPending ? 'wait' : 'pointer',
          }}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span>{isSittingOut ? '✓ ' : ''}{t('table.actions.sitOutNextHand')}</span>
          </div>
        </button>
      </div>

      <BetRaiseModal
        isOpen={showBetModal}
        onClose={() => setShowBetModal(false)}
        actionType="bet"
        currentPot={currentPot}
        minAmount={minRaise}
        maxAmount={effectiveMaxRaise}
        onSubmit={(amount) => onBet(amount)}
      />

      <BetRaiseModal
        isOpen={showRaiseModal}
        onClose={() => setShowRaiseModal(false)}
        actionType="raise"
        currentPot={currentPot}
        minAmount={minRaise}
        maxAmount={effectiveMaxRaise}
        onSubmit={(amount) => onRaise(amount)}
      />
    </div>
  )
}

