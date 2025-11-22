/**
 * GameControls - Fixed bottom game action controls
 * 
 * Replaces the standard BottomMenu when player is seated at a table.
 * Features:
 * - Fixed bottom dock with same height as BottomMenu (~72px)
 * - Three main actions: Fold (left), Check/Call (right), Bet/Raise (center)
 * - Integrates with existing action handlers
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BetRaiseModal from './BetRaiseModal'

export interface GameControlsProps {
  /** Whether it's the player's turn */
  isPlayerTurn: boolean
  /** Amount to call (0 if no bet to call) */
  amountToCall: number
  /** Minimum raise amount */
  minRaise: number
  /** Maximum raise amount */
  maxRaise: number
  /** Current pot for presets */
  currentPot: number
  /** Whether an action is pending */
  actionPending: boolean
  /** Handler for fold action */
  onFold: () => void
  /** Handler for check/call action */
  onCheckCall: () => void
  /** Handler for bet action */
  onBet: (amount: number) => void
  /** Handler for raise action */
  onRaise: (amount: number) => void
}

export default function GameControls({
  isPlayerTurn,
  amountToCall,
  minRaise,
  maxRaise,
  currentPot,
  actionPending,
  onFold,
  onCheckCall,
  onBet,
  onRaise,
}: GameControlsProps) {
  const { t } = useTranslation()
  const [showBetModal, setShowBetModal] = useState(false)

  const isDisabled = !isPlayerTurn || actionPending
  const canBet = amountToCall === 0

  const handleBetRaiseClick = () => {
    setShowBetModal(true)
  }

  const handleBetRaiseSubmit = (amount: number) => {
    if (canBet) {
      onBet(amount)
    } else {
      onRaise(amount)
    }
    setShowBetModal(false)
  }

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe pt-3 bg-gray-900 border-t border-white/10 shadow-lg"
        style={{ height: 'var(--bottom-nav-height, 72px)' }}
      >
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2">
          {/* Fold - Left (Red) */}
          <button
            onClick={onFold}
            disabled={isDisabled}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isDisabled
                ? 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)'
                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#ffffff',
              boxShadow: isDisabled ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.3)',
            }}
          >
            {t('table.actions.fold')}
          </button>

          {/* Bet/Raise - Center (Yellow/Gold) */}
          <button
            onClick={handleBetRaiseClick}
            disabled={isDisabled}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isDisabled
                ? 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)'
                : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: isDisabled ? '#ffffff' : '#1f2937',
              boxShadow: isDisabled ? 'none' : '0 2px 8px rgba(251, 191, 36, 0.4)',
            }}
          >
            {canBet ? t('table.actions.bet') : t('table.actions.raise')}
          </button>

          {/* Check/Call - Right (Green) */}
          <button
            onClick={onCheckCall}
            disabled={isDisabled}
            className="flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isDisabled
                ? 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              boxShadow: isDisabled ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.3)',
            }}
          >
            {amountToCall > 0
              ? t('table.actions.call', { amount: amountToCall })
              : t('table.actions.check')}
          </button>
        </div>
      </div>

      {/* Bet/Raise Modal */}
      <BetRaiseModal
        isOpen={showBetModal}
        onClose={() => setShowBetModal(false)}
        actionType={canBet ? 'bet' : 'raise'}
        currentPot={currentPot}
        minAmount={minRaise}
        maxAmount={maxRaise}
        onSubmit={handleBetRaiseSubmit}
      />
    </>
  )
}
