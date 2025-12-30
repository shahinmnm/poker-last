/**
 * Phase 5: ActionPanel Component (Backend-Driven)
 * 
 * Modern floating pill buttons inspired by GGPoker/PokerBros.
 * No full-width background bar - centered floating pills.
 * Renders action buttons based ONLY on backend legal_actions[].
 * 
 * SEMANTICS CONTRACT:
 * - call_amount: INCREMENTAL (chips to add to match current bet) - display as "Call {amount}"
 * - min_amount/max_amount for raise/bet: TOTAL-TO (total committed for street) - display as "Raise to {amount}"
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Minus, Plus } from 'lucide-react'
import type { LegalAction, ActionType } from '../../types/normalized'
import Toggle from '../ui/Toggle'
import { formatByCurrency, type CurrencyType } from '@/utils/currency'

interface ActionPanelProps {
  legalActions: LegalAction[]
  onAction: (action: ActionType, amount?: number) => void
  currency?: CurrencyType
  disabled?: boolean
  isSittingOut?: boolean
  onSitOutToggle?: (sitOut: boolean) => void
  showSitOutToggle?: boolean
}

export function ActionPanel({
  legalActions,
  onAction,
  currency = 'PLAY',
  disabled = false,
  isSittingOut = false,
  onSitOutToggle,
  showSitOutToggle = false,
}: ActionPanelProps) {
  const { t } = useTranslation()
  const [raiseAmount, setRaiseAmount] = useState<number | null>(null)
  const [showRaiseControl, setShowRaiseControl] = useState(false)

  // Find raise/bet action for slider
  const raiseAction = useMemo(() => {
    return legalActions.find((a) => a.action === 'raise' || a.action === 'bet')
  }, [legalActions])

  // TASK B.5: Reset raiseAmount to min_amount when new allowed_actions arrives
  // This prevents stale invalid values when the action context changes
  // Using raiseAction directly in deps ensures we react to any change in the action object
  useEffect(() => {
    if (raiseAction) {
      // Always reset to min_amount when raiseAction changes (new turn or new allowed_actions)
      setRaiseAmount(raiseAction.min_amount || 0)
    } else {
      // No raise action available, clear the amount
      setRaiseAmount(null)
    }
    // Close the raise control panel when actions change (new turn)
    setShowRaiseControl(false)
  }, [raiseAction])

  const handleAction = (action: ActionType, amount?: number) => {
    if (disabled) return
    onAction(action, amount)
    setShowRaiseControl(false)
  }

  const handleRaiseClick = () => {
    if (!raiseAction) return
    setShowRaiseControl(true)
  }

  const handleRaiseConfirm = () => {
    if (!raiseAction) return
    handleAction(raiseAction.action, raiseAmount || raiseAction.min_amount)
  }

  const incrementRaise = () => {
    if (!raiseAction || raiseAmount === null) return
    const step = Math.max(1, Math.floor((raiseAction.max_amount || 0) / 10))
    const newAmount = Math.min(raiseAmount + step, raiseAction.max_amount || raiseAmount)
    setRaiseAmount(newAmount)
  }

  const decrementRaise = () => {
    if (!raiseAction || raiseAmount === null) return
    const step = Math.max(1, Math.floor((raiseAction.max_amount || 0) / 10))
    const newAmount = Math.max(raiseAmount - step, raiseAction.min_amount || 0)
    setRaiseAmount(newAmount)
  }

  // Don't render if no legal actions AND sit out toggle is not shown
  if (legalActions.length === 0 && !showSitOutToggle) {
    return null
  }

  // Check which actions are available
  const hasCheck = legalActions.some(a => a.action === 'check')
  const callAction = legalActions.find(a => a.action === 'call')
  const hasAllIn = legalActions.some(a => a.action === 'all_in')
  const hasReady = legalActions.some(a => a.action === 'ready')

  // DEFENSIVE RULE: Do NOT show Fold if check is available or call amount is 0.
  // This is a safety net - the backend should already be correct, but we add
  // client-side protection against accidental fold buttons when there's "no reason to fold".
  const toCall = callAction?.call_amount ?? 0
  const hasFold = legalActions.some(a => a.action === 'fold') && !hasCheck && toCall > 0

  return (
    <div className="action-panel flex flex-col items-center gap-3">
      {/* Leave After Hand Toggle - glassmorphism pill at top */}
      {showSitOutToggle && onSitOutToggle && (
        <div className="sit-out-toggle bg-[var(--surface-1)] backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-3 border border-[var(--border-2)]">
          <label htmlFor="sit-out-toggle" className="text-xs font-medium text-[var(--text-2)] cursor-pointer">
            {isSittingOut 
              ? t('table.actions.leavingAfterHand', { defaultValue: 'Leaving after hand' })
              : t('table.actions.leaveAfterHand', { defaultValue: 'Leave after hand' })}
          </label>
          <Toggle
            id="sit-out-toggle"
            checked={isSittingOut}
            onChange={onSitOutToggle}
            disabled={disabled}
          />
        </div>
      )}

      {/* Main action buttons - floating pills with premium casino styling */}
      {legalActions.length > 0 && (
        <div className="flex gap-3 items-end flex-wrap justify-center">
          {/* Fold button - Secondary action: muted rose, less prominent */}
          {hasFold && (
            <button
              onClick={() => handleAction('fold')}
              disabled={disabled}
              className="min-h-[44px] bg-gradient-to-b from-rose-600/80 to-rose-800/80 shadow-md shadow-rose-900/40 text-white/95 font-bold px-6 h-10 rounded-full transition-all duration-150 hover:scale-105 active:scale-[0.97] active:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:ring-0 focus:outline-none focus:ring-2 focus:ring-rose-400/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 whitespace-nowrap"
            >
              {t('table.actionBar.fold', { defaultValue: 'Fold' })}
            </button>
          )}

          {/* Check button - Primary action: vibrant emerald */}
          {hasCheck && (
            <button
              onClick={() => handleAction('check')}
              disabled={disabled}
              className="min-h-[44px] bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-300/30 text-white font-bold px-6 h-10 rounded-full transition-all duration-150 hover:scale-105 active:scale-[0.97] active:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:ring-0 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 whitespace-nowrap"
            >
              {t('table.actionBar.check', { defaultValue: 'Check' })}
            </button>
          )}

          {/* Call button - Primary action: vibrant emerald */}
          {callAction && (
            <button
              onClick={() => handleAction('call')}
              disabled={disabled}
              className="min-h-[44px] bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-300/30 text-white font-bold px-6 h-10 rounded-full transition-all duration-150 hover:scale-105 active:scale-[0.97] active:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:ring-0 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 whitespace-nowrap"
            >
              {callAction.call_amount !== undefined
                ? t('table.actionBar.call', { defaultValue: 'Call {{amount}}', amount: formatByCurrency(callAction.call_amount, currency) })
                : t('table.actionBar.check', { defaultValue: 'Call' })}
            </button>
          )}

          {/* Raise/Bet Control - composite pill UI */}
          {/* Button shows "Raise to {min}" or "Bet {min}" - amounts are TOTAL-TO values */}
          {raiseAction && !showRaiseControl && (
            <button
              onClick={handleRaiseClick}
              disabled={disabled}
              className="min-h-[44px] bg-gradient-to-b from-blue-500 to-blue-700 shadow-lg shadow-blue-900/50 ring-1 ring-blue-400/30 text-white font-bold px-6 h-10 rounded-full transition-all duration-150 hover:scale-105 hover:brightness-110 active:scale-[0.97] active:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:ring-0 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 whitespace-nowrap"
            >
              {raiseAction.action === 'raise' 
                ? t('table.actionBar.raise', { defaultValue: 'Raise to {{amount}}', amount: formatByCurrency(raiseAction.min_amount || 0, currency) })
                : t('table.actionBar.bet', { defaultValue: 'Bet {{amount}}', amount: formatByCurrency(raiseAction.min_amount || 0, currency) })}
            </button>
          )}

          {/* Expanded Raise Control - composite pill */}
          {/* Amount displayed and submitted is TOTAL-TO (total committed for street) */}
          {raiseAction && showRaiseControl && (
            <div className="bg-[var(--surface-1)] backdrop-blur-md rounded-full p-1 flex items-center gap-1 border border-[var(--border-2)]">
              {/* Minus button */}
              <button
                onClick={decrementRaise}
                disabled={disabled}
                className="min-h-[44px] min-w-[44px] w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-300/60 motion-reduce:transition-none"
              >
                <Minus size={14} />
              </button>
              
              {/* Amount display - shows "to {amount}" label for clarity */}
              <div className="px-3 min-w-[80px] text-center">
                <span className="text-[var(--text-3)] text-xs mr-1">{t('table.actionBar.to', { defaultValue: 'to' })}</span>
                <span className="text-emerald-400 font-bold text-sm tabular-nums">
                  {formatByCurrency(raiseAmount || raiseAction.min_amount || 0, currency)}
                </span>
              </div>
              
              {/* Plus button */}
              <button
                onClick={incrementRaise}
                disabled={disabled}
                className="min-h-[44px] min-w-[44px] w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-300/60 motion-reduce:transition-none"
              >
                <Plus size={14} />
              </button>
              
              {/* Confirm button - matches primary gradient style */}
              <button
                onClick={handleRaiseConfirm}
                disabled={disabled}
                className="min-h-[44px] bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full px-4 py-1 text-sm font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-300/60 motion-reduce:transition-none"
              >
                {raiseAction.action === 'raise' 
                  ? t('table.actionBar.raiseToLabel', { defaultValue: 'Raise to' })
                  : t('table.actionBar.betLabel', { defaultValue: 'Bet' })}
              </button>
              
              {/* Cancel button */}
              <button
                onClick={() => setShowRaiseControl(false)}
                className="min-h-[44px] min-w-[44px] w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[var(--text-2)] transition-colors text-xs focus:outline-none focus:ring-2 focus:ring-white/30 motion-reduce:transition-none"
              >
                ✕
              </button>
            </div>
          )}

          {/* All In button - danger pill, consistent with legacy styling */}
          {hasAllIn && (
            <button
              onClick={() => handleAction('all_in')}
              disabled={disabled}
              className="min-h-[44px] bg-gradient-to-b from-rose-500 to-rose-700 shadow-lg shadow-rose-900/50 text-white font-bold px-6 h-10 rounded-full transition-all duration-150 hover:scale-105 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-rose-400/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 whitespace-nowrap"
            >
              {t('table.actions.allIn', { defaultValue: 'All In' })}
            </button>
          )}

          {/* Ready button - primary pill */}
          {hasReady && (
            <button
              onClick={() => handleAction('ready')}
              disabled={disabled}
              className="min-h-[44px] bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/50 text-white font-bold px-6 h-10 rounded-full transition-all duration-150 hover:scale-105 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 whitespace-nowrap"
            >
              {t('table.actions.ready', { defaultValue: 'Ready' })}
            </button>
          )}
        </div>
      )}

      {/* Presets - shown when raise control is open */}
      {showRaiseControl && raiseAction && raiseAction.presets && raiseAction.presets.length > 0 && (
        <div className="flex gap-2 justify-center">
          {raiseAction.presets.map((preset, index) => (
            <button
              key={index}
              onClick={() => setRaiseAmount(preset.amount)}
              disabled={disabled}
              className="min-h-[44px] bg-[var(--surface-2)] backdrop-blur-sm text-[var(--text-2)] text-xs font-medium px-3 py-1 rounded-full border border-[var(--border-3)] hover:bg-[var(--surface-1)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-300/60 motion-reduce:transition-none"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActionPanel
