import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AllowedAction } from '@/types/game'
import { formatChips } from '@/utils/formatChips'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface ActionBarProps {
  allowedActions: AllowedAction[]
  onAction: (action: AllowedAction['action_type'], amount?: number) => void
  isProcessing: boolean
  myStack: number
  isMyTurn?: boolean
  isShowdown?: boolean
}

const clampAmount = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const multiplierPresets = [4, 3, 2.5] as const

export default function ActionBar({
  allowedActions,
  onAction,
  isProcessing,
  myStack,
  isMyTurn = false,
  isShowdown = false,
}: ActionBarProps) {
  const { t } = useTranslation()
  const haptic = useHapticFeedback()

  const foldAction = useMemo(
    () => allowedActions.find((action) => action.action_type === 'fold'),
    [allowedActions],
  )
  const checkAction = useMemo(
    () => allowedActions.find((action) => action.action_type === 'check'),
    [allowedActions],
  )
  const callAction = useMemo(
    () => allowedActions.find((action) => action.action_type === 'call'),
    [allowedActions],
  )
  const raiseAction = useMemo(
    () => allowedActions.find((action) => ['bet', 'raise', 'all_in'].includes(action.action_type)),
    [allowedActions],
  )

  const minAmount = raiseAction?.min_amount ?? 0
  const maxAmount = raiseAction?.max_amount ?? myStack ?? 0
  const upperBound = maxAmount > 0 ? maxAmount : Math.max(minAmount, myStack ?? 0, 0)
  const [amount, setAmount] = useState(() => clampAmount(minAmount || 0, minAmount, upperBound))

  useEffect(() => {
    setAmount(clampAmount(minAmount || 0, minAmount, upperBound))
  }, [minAmount, upperBound, raiseAction])

  const isDisabled = isProcessing || !isMyTurn
  const hasBetting = !!raiseAction && !isShowdown
  const step = useMemo(() => Math.max(1, Math.round(Math.abs(upperBound - minAmount) / 8)), [upperBound, minAmount])

  const adjustAmount = (direction: 1 | -1) => {
    if (!hasBetting) return
    haptic.selectionChanged()
    setAmount((previous) => clampAmount((previous || minAmount) + direction * step, minAmount, upperBound))
  }

  const applyMultiplier = (multiplier: number | 'all-in') => {
    if (!hasBetting) return
    if (multiplier === 'all-in') {
      setAmount(clampAmount(upperBound, minAmount, upperBound))
      return
    }
    const base = minAmount || upperBound
    setAmount(clampAmount(Math.round(base * multiplier), minAmount, upperBound))
    haptic.selectionChanged()
  }

  const handleFold = () => {
    if (!foldAction || isDisabled) return
    haptic.impact('medium')
    onAction('fold')
  }

  const handleCallOrCheck = () => {
    if (isDisabled) return
    if (checkAction) {
      haptic.impact('light')
      onAction('check')
      return
    }
    if (callAction) {
      haptic.impact('light')
      onAction('call', callAction.amount)
    }
  }

  const handleRaise = () => {
    if (!hasBetting || isDisabled) return
    const actionType =
      raiseAction?.action_type === 'bet'
        ? 'bet'
        : raiseAction?.action_type === 'all_in' || amount >= upperBound
          ? 'all_in'
          : 'raise'
    haptic.notification('success')
    onAction(actionType, amount)
  }

  const foldLabel = t('table.actionBar.fold', { defaultValue: 'Fold' }).toUpperCase()
  const callLabel = t('table.actions.call', { defaultValue: 'Call' }).toUpperCase()
  const checkLabel = t('table.actionBar.check', { defaultValue: 'Check' }).toUpperCase()
  const raiseLabel = t('table.actions.raiseTo', { defaultValue: 'Raise to' }).toUpperCase()
  const betLabel = t('table.actionBar.betLabel', { defaultValue: 'Bet' }).toUpperCase()
  const callAmount = callAction?.amount ?? 0
  const callOrCheckLabel = checkAction
    ? checkLabel
    : callAction
      ? callAmount > 0
        ? `${callLabel} ${formatChips(callAmount)}`
        : callLabel
      : callLabel
  const raiseToLabel = `${raiseLabel} ${formatChips(amount ?? 0)}`
  const betAmountLabel = formatChips(amount ?? 0)

  return (
    <div className="action-panel">
      <div className="action-panel__bet-zone" aria-label="Bet sizing">
        <div className="action-panel__bet-display">
          <span className="action-panel__bet-label">
            {raiseAction?.action_type === 'bet' ? betLabel : raiseLabel}
          </span>
          <span className="action-panel__bet-amount tabular-nums">{betAmountLabel}</span>
        </div>
        <div className="action-panel__slider-row">
          <button
            type="button"
            onClick={() => adjustAmount(-1)}
            disabled={isDisabled || !hasBetting}
            aria-label={t('table.actionBar.decreaseAmount', { defaultValue: 'Decrease amount' })}
            className="action-panel__adjust"
          >
            -
          </button>
          <input
            type="range"
            min={minAmount}
            max={upperBound || minAmount || 1}
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            disabled={isDisabled || !hasBetting}
            className="action-panel__slider"
          />
          <button
            type="button"
            onClick={() => adjustAmount(1)}
            disabled={isDisabled || !hasBetting}
            aria-label={t('table.actionBar.increaseAmount', { defaultValue: 'Increase amount' })}
            className="action-panel__adjust"
          >
            +
          </button>
        </div>
      </div>

      <div className="action-panel__multipliers" aria-label="Bet multipliers">
        <button
          type="button"
          onClick={() => applyMultiplier('all-in')}
          disabled={isDisabled || !hasBetting}
          className="action-panel__multiplier action-panel__multiplier--allin"
        >
          {t('table.actions.allIn', { defaultValue: 'All-in' }).toUpperCase()}
        </button>
        {multiplierPresets.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => applyMultiplier(value)}
            disabled={isDisabled || !hasBetting}
            className="action-panel__multiplier"
          >
            {`${value}X`}
          </button>
        ))}
      </div>

      <div className="action-panel__actions" aria-label="Primary actions">
        <button
          type="button"
          onClick={handleFold}
          disabled={!foldAction || isDisabled}
          className="action-panel__action action-panel__action--fold"
        >
          <span className="action-panel__action-label">{foldLabel}</span>
        </button>

        <button
          type="button"
          onClick={handleCallOrCheck}
          disabled={!(checkAction || callAction) || isDisabled}
          className="action-panel__action action-panel__action--call"
        >
          <span className="action-panel__action-label">{callOrCheckLabel}</span>
        </button>

        <button
          type="button"
          onClick={handleRaise}
          disabled={!hasBetting || isDisabled}
          className="action-panel__action action-panel__action--raise"
        >
          <span className="action-panel__action-label">{raiseToLabel}</span>
        </button>
      </div>
    </div>
  )
}
