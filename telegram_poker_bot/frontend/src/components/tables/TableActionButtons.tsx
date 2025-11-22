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
}

export default function TableActionButtons({
  isPlayerTurn,
  amountToCall,
  minRaise,
  playerStack,
  playerBet,
  actionPending,
  currentPot = 0,
  maxRaise,
  onFold,
  onCheckCall,
  onBet,
  onRaise,
  onAllIn,
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

