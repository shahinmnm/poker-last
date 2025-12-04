/**
 * Phase 5: ActionPanel Component (Backend-Driven)
 * 
 * Renders action buttons based ONLY on backend legal_actions[].
 * No client-side calculations. No variant heuristics.
 */

import { useState, useMemo } from 'react'
import type { LegalAction, ActionType } from '../../types/normalized'
import Button from '../ui/Button'
import { formatByCurrency } from '@/utils/currency'

interface ActionPanelProps {
  legalActions: LegalAction[]
  onAction: (action: ActionType, amount?: number) => void
  currency?: string
  disabled?: boolean
}

export function ActionPanel({
  legalActions,
  onAction,
  currency = 'chips',
  disabled = false,
}: ActionPanelProps) {
  const [raiseAmount, setRaiseAmount] = useState<number | null>(null)
  const [showRaiseSlider, setShowRaiseSlider] = useState(false)

  // Find raise/bet action for slider
  const raiseAction = useMemo(() => {
    return legalActions.find((a) => a.action === 'raise' || a.action === 'bet')
  }, [legalActions])

  // Initialize raise amount
  useMemo(() => {
    if (raiseAction && raiseAmount === null) {
      setRaiseAmount(raiseAction.min_amount || 0)
    }
  }, [raiseAction, raiseAmount])

  const handleAction = (action: ActionType, amount?: number) => {
    if (disabled) return
    onAction(action, amount)
    setShowRaiseSlider(false)
  }

  const handleRaiseClick = () => {
    if (!raiseAction) return
    
    if (!showRaiseSlider) {
      setShowRaiseSlider(true)
    } else {
      handleAction(raiseAction.action, raiseAmount || raiseAction.min_amount)
    }
  }

  const handlePreset = (amount: number) => {
    setRaiseAmount(amount)
  }

  // Render nothing if no actions available
  if (legalActions.length === 0) {
    return null
  }

  return (
    <div className="action-panel bg-gray-800 rounded-lg p-4 space-y-3">
      {/* Main action buttons */}
      <div className="flex gap-2 flex-wrap">
        {legalActions.map((action) => {
          if (action.action === 'raise' || action.action === 'bet') {
            // Raise/Bet button with slider
            return (
              <Button
                key={action.action}
                onClick={handleRaiseClick}
                variant={showRaiseSlider ? 'primary' : 'default'}
                disabled={disabled}
                className="flex-1 min-w-[100px]"
              >
                {action.action === 'raise' ? 'Raise' : 'Bet'}
                {showRaiseSlider && raiseAmount !== null && (
                  <span className="ml-2 font-mono">
                    {formatByCurrency(raiseAmount, currency)}
                  </span>
                )}
              </Button>
            )
          }

          if (action.action === 'call') {
            return (
              <Button
                key={action.action}
                onClick={() => handleAction('call')}
                variant="success"
                disabled={disabled}
                className="flex-1 min-w-[100px]"
              >
                Call{' '}
                {action.call_amount !== undefined && (
                  <span className="font-mono ml-1">
                    {formatByCurrency(action.call_amount, currency)}
                  </span>
                )}
              </Button>
            )
          }

          if (action.action === 'check') {
            return (
              <Button
                key={action.action}
                onClick={() => handleAction('check')}
                variant="success"
                disabled={disabled}
                className="flex-1 min-w-[100px]"
              >
                Check
              </Button>
            )
          }

          if (action.action === 'fold') {
            return (
              <Button
                key={action.action}
                onClick={() => handleAction('fold')}
                variant="danger"
                disabled={disabled}
                className="flex-1 min-w-[100px]"
              >
                Fold
              </Button>
            )
          }

          if (action.action === 'all_in') {
            return (
              <Button
                key={action.action}
                onClick={() => handleAction('all_in')}
                variant="warning"
                disabled={disabled}
                className="flex-1 min-w-[100px]"
              >
                All In
              </Button>
            )
          }

          if (action.action === 'ready') {
            return (
              <Button
                key={action.action}
                onClick={() => handleAction('ready')}
                variant="primary"
                disabled={disabled}
                className="flex-1 min-w-[100px]"
              >
                Ready
              </Button>
            )
          }

          // Generic action button
          return (
            <Button
              key={action.action}
              onClick={() => handleAction(action.action)}
              disabled={disabled}
              className="flex-1 min-w-[100px]"
            >
              {action.action}
            </Button>
          )
        })}
      </div>

      {/* Raise/Bet slider */}
      {showRaiseSlider && raiseAction && (
        <div className="raise-slider space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>
              Min: {formatByCurrency(raiseAction.min_amount || 0, currency)}
            </span>
            <span>
              Max: {formatByCurrency(raiseAction.max_amount || 0, currency)}
            </span>
          </div>

          <input
            type="range"
            min={raiseAction.min_amount || 0}
            max={raiseAction.max_amount || 0}
            value={raiseAmount || raiseAction.min_amount || 0}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            className="w-full"
            disabled={disabled}
          />

          <div className="text-center text-lg font-mono text-white">
            {formatByCurrency(raiseAmount || raiseAction.min_amount || 0, currency)}
          </div>

          {/* Presets */}
          {raiseAction.presets && raiseAction.presets.length > 0 && (
            <div className="flex gap-2 justify-center">
              {raiseAction.presets.map((preset, index) => (
                <Button
                  key={index}
                  onClick={() => handlePreset(preset.amount)}
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ActionPanel
