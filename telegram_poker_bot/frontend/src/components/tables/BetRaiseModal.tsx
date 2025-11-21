import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../ui/Modal'
import GlassButton from '../ui/GlassButton'

interface BetRaiseModalProps {
  isOpen: boolean
  onClose: () => void
  actionType: 'bet' | 'raise'
  currentPot: number
  minAmount: number
  maxAmount: number
  onSubmit: (amount: number) => void
}

export default function BetRaiseModal({
  isOpen,
  onClose,
  actionType,
  currentPot,
  minAmount,
  maxAmount,
  onSubmit,
}: BetRaiseModalProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState(minAmount)

  useEffect(() => {
    if (isOpen) {
      setAmount(minAmount)
    }
  }, [isOpen, minAmount])

  const calculatePreset = (fraction: number): number => {
    const targetAmount = Math.round(currentPot * fraction)
    return Math.min(Math.max(targetAmount, minAmount), maxAmount)
  }

  const handlePresetClick = (fraction: number) => {
    const presetAmount = calculatePreset(fraction)
    setAmount(presetAmount)
  }

  const handleSubmit = () => {
    if (amount >= minAmount && amount <= maxAmount) {
      onSubmit(amount)
      onClose()
    }
  }

  const handleAmountChange = (value: string) => {
    const numValue = parseInt(value, 10)
    if (!isNaN(numValue)) {
      setAmount(Math.min(Math.max(numValue, minAmount), maxAmount))
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={actionType === 'bet' ? t('table.actions.bet') : t('table.actions.raise')}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => handlePresetClick(0.5)}
            className="rounded-lg px-2 py-2 text-xs font-medium transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            {t('table.actions.presets.halfPot')}
          </button>
          <button
            onClick={() => handlePresetClick(0.67)}
            className="rounded-lg px-2 py-2 text-xs font-medium transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            {t('table.actions.presets.twoThirdsPot')}
          </button>
          <button
            onClick={() => handlePresetClick(1.0)}
            className="rounded-lg px-2 py-2 text-xs font-medium transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            {t('table.actions.presets.pot')}
          </button>
          <button
            onClick={() => setAmount(maxAmount)}
            className="rounded-lg px-2 py-2 text-xs font-medium transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          >
            {t('table.actions.presets.allIn')}
          </button>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-[color:var(--text-primary)]">
            Amount
          </label>
          <input
            type="range"
            min={minAmount}
            max={maxAmount}
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value, 10))}
            className="w-full"
          />
          <div className="mt-2 flex items-center justify-between text-xs text-[color:var(--text-muted)]">
            <span>{minAmount}</span>
            <span className="text-base font-bold text-[color:var(--text-primary)]">{amount}</span>
            <span>{maxAmount}</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-[color:var(--text-primary)]">
            Or enter amount
          </label>
          <input
            type="number"
            min={minAmount}
            max={maxAmount}
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <GlassButton variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </GlassButton>
          <GlassButton
            variant={actionType === 'bet' ? 'bet' : 'raise'}
            onClick={handleSubmit}
            disabled={amount < minAmount || amount > maxAmount}
            fullWidth
          >
            {actionType === 'bet' ? t('table.actions.bet') : t('table.actions.raise')} {amount}
          </GlassButton>
        </div>
      </div>
    </Modal>
  )
}
