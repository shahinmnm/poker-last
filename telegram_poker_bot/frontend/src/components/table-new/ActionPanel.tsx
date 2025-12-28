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
      {/* Sit Out Toggle - glassmorphism pill at top */}
      {showSitOutToggle && onSitOutToggle && (
        <div className="sit-out-toggle bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-3">
          <label htmlFor="sit-out-toggle" className="text-xs font-medium text-gray-200 cursor-pointer">
            Sit Out
          </label>
          <Toggle
            id="sit-out-toggle"
            checked={isSittingOut}
            onChange={onSitOutToggle}
            disabled={disabled}
          />
        </div>
      )}

      {/* Main action buttons - floating pills */}
      {legalActions.length > 0 && (
        <div className="flex gap-3 items-end">
          {/* Fold button - rose gradient pill */}
          {hasFold && (
            <button
              onClick={() => handleAction('fold')}
              disabled={disabled}
              className="bg-gradient-to-b from-rose-500 to-rose-700 shadow-lg shadow-rose-900/50 text-white font-bold px-6 h-10 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Fold
            </button>
          )}

          {/* Check button - emerald gradient pill */}
          {hasCheck && (
            <button
              onClick={() => handleAction('check')}
              disabled={disabled}
              className="bg-gradient-to-b from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/50 text-white font-bold px-6 h-10 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check
            </button>
          )}

          {/* Call button - emerald gradient pill */}
          {callAction && (
            <button
              onClick={() => handleAction('call')}
              disabled={disabled}
              className="bg-gradient-to-b from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/50 text-white font-bold px-6 h-10 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Call{' '}
              {callAction.call_amount !== undefined && (
                <span className="font-mono ml-1">
                  {formatByCurrency(callAction.call_amount, currency)}
                </span>
              )}
            </button>
          )}

          {/* Raise/Bet Control - composite pill UI */}
          {/* Button shows "Raise to {min}" or "Bet {min}" - amounts are TOTAL-TO values */}
          {raiseAction && !showRaiseControl && (
            <button
              onClick={handleRaiseClick}
              disabled={disabled}
              className="bg-gradient-to-b from-blue-500 to-blue-700 shadow-lg shadow-blue-900/50 text-white font-bold px-6 h-10 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {raiseAction.action === 'raise' ? 'Raise to ' : 'Bet '}
              <span className="font-mono">
                {formatByCurrency(raiseAction.min_amount || 0, currency)}
              </span>
            </button>
          )}

          {/* Expanded Raise Control - composite pill */}
          {/* Amount displayed and submitted is TOTAL-TO (total committed for street) */}
          {raiseAction && showRaiseControl && (
            <div className="bg-black/60 backdrop-blur-md rounded-full p-1 flex items-center gap-1">
              {/* Minus button */}
              <button
                onClick={decrementRaise}
                disabled={disabled}
                className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors disabled:opacity-50"
              >
                <Minus size={14} />
              </button>
              
              {/* Amount display - shows "to {amount}" label for clarity */}
              <div className="px-3 min-w-[80px] text-center">
                <span className="text-gray-400 text-xs mr-1">to</span>
                <span className="text-emerald-400 font-bold text-sm">
                  {formatByCurrency(raiseAmount || raiseAction.min_amount || 0, currency)}
                </span>
              </div>
              
              {/* Plus button */}
              <button
                onClick={incrementRaise}
                disabled={disabled}
                className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
              </button>
              
              {/* Confirm button - shows "Raise to" or "Bet" */}
              <button
                onClick={handleRaiseConfirm}
                disabled={disabled}
                className="bg-emerald-500 hover:bg-emerald-600 rounded-full px-4 py-1 text-sm font-bold text-white transition-colors disabled:opacity-50"
              >
                {raiseAction.action === 'raise' ? 'Raise' : 'Bet'}
              </button>
              
              {/* Cancel button */}
              <button
                onClick={() => setShowRaiseControl(false)}
                className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 transition-colors text-xs"
              >
                ✕
              </button>
            </div>
          )}

          {/* All In button - danger pill */}
          {hasAllIn && (
            <button
              onClick={() => handleAction('all_in')}
              disabled={disabled}
              className="bg-gradient-to-b from-red-500 to-red-700 shadow-lg shadow-red-900/50 text-white font-bold px-6 h-10 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              All In
            </button>
          )}

          {/* Ready button - primary pill */}
          {hasReady && (
            <button
              onClick={() => handleAction('ready')}
              disabled={disabled}
              className="bg-gradient-to-b from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/50 text-white font-bold px-6 h-10 rounded-full transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ready
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
              className="bg-black/40 backdrop-blur-sm text-gray-200 text-xs font-medium px-3 py-1 rounded-full hover:bg-black/60 transition-colors disabled:opacity-50"
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
