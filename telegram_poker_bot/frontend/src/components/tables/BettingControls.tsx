/**
 * BettingControls - Glassmorphism betting interface
 * 
 * Bottom sheet style betting controls with slider and preset buttons.
 * Displays amounts in human-readable currency format while handling BigInt internally.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '../../utils/currency'

interface BettingControlsProps {
  /** Whether this is a bet or raise action */
  actionType: 'bet' | 'raise'
  /** Minimum amount in cents */
  minAmount: number
  /** Maximum amount in cents (player's stack) */
  maxAmount: number
  /** Current pot size in cents for presets */
  currentPot: number
  /** Whether action is pending */
  isPending?: boolean
  /** Callback when bet/raise is submitted */
  onSubmit: (amount: number) => void
  /** Callback when cancelled */
  onCancel: () => void
}

export default function BettingControls({
  actionType,
  minAmount,
  maxAmount,
  currentPot,
  isPending = false,
  onSubmit,
  onCancel,
}: BettingControlsProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(minAmount)

  // Reset to minimum when props change
  useEffect(() => {
    setAmount(minAmount)
  }, [minAmount, actionType])

  /**
   * Calculate preset amount based on pot fraction
   */
  const calculatePreset = (fraction: number): number => {
    const targetAmount = Math.round(currentPot * fraction)
    return Math.min(Math.max(targetAmount, minAmount), maxAmount)
  }

  /**
   * Handle preset button click
   */
  const handlePresetClick = (fraction: number) => {
    const presetAmount = calculatePreset(fraction)
    setAmount(presetAmount)
  }

  /**
   * Handle slider change
   */
  const handleSliderChange = (value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue)) {
      setAmount(Math.min(Math.max(numValue, minAmount), maxAmount))
    }
  }

  /**
   * Handle submit
   */
  const handleSubmit = () => {
    if (amount >= minAmount && amount <= maxAmount && !isPending) {
      onSubmit(amount)
    }
  }

  const isDisabled = isPending || amount < minAmount || amount > maxAmount

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto">
      {/* Glassmorphism Bottom Sheet */}
      <div
        className="backdrop-blur-xl border-t shadow-2xl"
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="px-4 py-4 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">
              {actionType === 'bet' ? t('table.actions.bet') : t('table.actions.raise')}
            </h3>
            <button
              onClick={onCancel}
              disabled={isPending}
              className="text-white/60 hover:text-white/90 transition-colors text-sm font-medium"
            >
              {t('common.cancel')}
            </button>
          </div>

          {/* Amount Display */}
          <div className="text-center mb-4">
            <p className="text-[10px] uppercase tracking-widest text-emerald-400/80 font-bold mb-1">
              {t('table.betting.amount', { defaultValue: 'Amount' })}
            </p>
            <p className="text-4xl font-bold text-white">
              {formatCurrency(amount)}
            </p>
          </div>

          {/* Slider */}
          <div className="mb-4">
            <input
              type="range"
              min={minAmount}
              max={maxAmount}
              value={amount}
              onChange={(e) => handleSliderChange(e.target.value)}
              disabled={isPending}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #10b981 0%, #10b981 ${
                  ((amount - minAmount) / (maxAmount - minAmount)) * 100
                }%, rgba(255,255,255,0.1) ${
                  ((amount - minAmount) / (maxAmount - minAmount)) * 100
                }%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
            <div className="flex items-center justify-between mt-2 text-xs text-white/60">
              <span>{formatCurrency(minAmount)}</span>
              <span>{formatCurrency(maxAmount)}</span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => handlePresetClick(0.5)}
              disabled={isPending}
              className="py-2 px-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
              }}
            >
              {t('table.actions.presets.halfPot', { defaultValue: '1/2 Pot' })}
              <span className="block text-[10px] text-white/60 mt-0.5">
                {formatCurrency(calculatePreset(0.5))}
              </span>
            </button>
            <button
              onClick={() => handlePresetClick(1.0)}
              disabled={isPending}
              className="py-2 px-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
              }}
            >
              {t('table.actions.presets.pot', { defaultValue: 'Pot' })}
              <span className="block text-[10px] text-white/60 mt-0.5">
                {formatCurrency(calculatePreset(1.0))}
              </span>
            </button>
            <button
              onClick={() => setAmount(maxAmount)}
              disabled={isPending}
              className="py-2 px-3 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
              }}
            >
              {t('table.actions.presets.max', { defaultValue: 'Max' })}
              <span className="block text-[10px] text-white/60 mt-0.5">
                {formatCurrency(maxAmount)}
              </span>
            </button>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            className="w-full py-3 rounded-xl font-bold text-base transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: isDisabled
                ? 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)'
                : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: isDisabled ? '#ffffff' : '#1f2937',
              boxShadow: isDisabled ? 'none' : '0 4px 12px rgba(251, 191, 36, 0.4)',
            }}
          >
            {isPending
              ? t('common.loading', { defaultValue: 'Loading...' })
              : actionType === 'bet'
                ? t('table.actions.betAmount', { amount: formatCurrency(amount), defaultValue: `Bet ${formatCurrency(amount)}` })
                : t('table.actions.raiseAmount', { amount: formatCurrency(amount), defaultValue: `Raise to ${formatCurrency(amount)}` })}
          </button>
        </div>
      </div>
    </div>
  )
}
