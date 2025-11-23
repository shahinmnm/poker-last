/**
 * ActionDock - Fixed bottom action bar for poker table
 * 
 * Smart rendering of poker actions based on game state:
 * - Shows "Check" when no bet to call
 * - Shows "Call [Amount]" when facing a bet
 * - "Bet/Raise" button opens BettingControls
 * - Fold button always available
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/currency'
import BettingControls from './BettingControls'

interface ActionDockProps {
  /** Whether it's the player's turn */
  isPlayerTurn: boolean
  /** Amount to call in cents (0 if can check) */
  amountToCall: number
  /** Minimum raise amount in cents */
  minRaise: number
  /** Maximum raise amount in cents */
  maxRaise: number
  /** Current pot size in cents */
  currentPot: number
  /** Whether an action is pending */
  actionPending: boolean
  /** Whether player can bet (no bet to call) */
  canBet: boolean
  /** Handler for fold action */
  onFold: () => void
  /** Handler for check action */
  onCheck: () => void
  /** Handler for call action */
  onCall: () => void
  /** Handler for bet action with amount */
  onBet: (amount: number) => void
  /** Handler for raise action with amount */
  onRaise: (amount: number) => void
}

export default function ActionDock({
  isPlayerTurn,
  amountToCall,
  minRaise,
  maxRaise,
  currentPot,
  actionPending,
  canBet,
  onFold,
  onCheck,
  onCall,
  onBet,
  onRaise,
}: ActionDockProps) {
  const { t } = useTranslation()
  const [showBettingControls, setShowBettingControls] = useState(false)

  const isDisabled = !isPlayerTurn || actionPending

  /**
   * Handle bet/raise button click
   */
  const handleBetRaiseClick = () => {
    if (!isDisabled) {
      setShowBettingControls(true)
    }
  }

  /**
   * Handle bet/raise submit from BettingControls
   */
  const handleBetRaiseSubmit = (amount: number) => {
    if (canBet) {
      onBet(amount)
    } else {
      onRaise(amount)
    }
    setShowBettingControls(false)
  }

  /**
   * Handle check/call button click
   */
  const handleCheckCall = () => {
    if (amountToCall > 0) {
      onCall()
    } else {
      onCheck()
    }
  }

  // Don't render anything if not seated
  if (!isPlayerTurn && !actionPending) {
    return null
  }

  // If betting controls are open, show them instead
  if (showBettingControls) {
    return (
      <BettingControls
        actionType={canBet ? 'bet' : 'raise'}
        minAmount={minRaise}
        maxAmount={maxRaise}
        currentPot={currentPot}
        isPending={actionPending}
        onSubmit={handleBetRaiseSubmit}
        onCancel={() => setShowBettingControls(false)}
      />
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto">
      <div
        className="backdrop-blur-xl border-t shadow-2xl"
        style={{
          background: 'rgba(0, 0, 0, 0.4)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="px-4 py-3 max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-2">
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
              {t('table.actions.fold', { defaultValue: 'Fold' })}
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
              {canBet
                ? t('table.actions.bet', { defaultValue: 'Bet' })
                : t('table.actions.raise', { defaultValue: 'Raise' })}
            </button>

            {/* Check/Call - Right (Green) */}
            <button
              onClick={handleCheckCall}
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
              {amountToCall > 0 ? (
                <>
                  {t('table.actions.call', { defaultValue: 'Call' })}{' '}
                  <span className="font-bold">{formatCurrency(amountToCall)}</span>
                </>
              ) : (
                t('table.actions.check', { defaultValue: 'Check' })
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
