import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import type { AllowedAction } from '@/types/game'
import { formatChips } from '@/utils/formatChips'

interface ActionBarProps {
  allowedActions: AllowedAction[]
  onAction: (action: AllowedAction['action_type'], amount?: number) => void
  isProcessing: boolean
  myStack: number
  isMyTurn?: boolean
}

const clampAmount = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const sliderActions: AllowedAction['action_type'][] = ['bet', 'raise', 'all_in']

export default function ActionBar({
  allowedActions,
  onAction,
  isProcessing,
  myStack,
  isMyTurn = false,
}: ActionBarProps) {
  const { t } = useTranslation()

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
  const betAction = useMemo(
    () => allowedActions.find((action) => action.action_type === 'bet'),
    [allowedActions],
  )
  const raiseAction = useMemo(
    () => allowedActions.find((action) => ['raise', 'all_in'].includes(action.action_type)),
    [allowedActions],
  )

  const primarySliderAction = betAction ?? raiseAction ?? null
  const [activeBetAction, setActiveBetAction] = useState<AllowedAction | null>(primarySliderAction)

  const minAmount = activeBetAction?.min_amount ?? primarySliderAction?.min_amount ?? 0
  const maxAmount = activeBetAction?.max_amount ?? primarySliderAction?.max_amount ?? myStack
  const [betAmount, setBetAmount] = useState(() => clampAmount(minAmount || 0, minAmount, maxAmount || myStack))
  const [isAdjustingBet, setIsAdjustingBet] = useState(false)

  useEffect(() => {
    if (!isMyTurn) {
      setIsAdjustingBet(false)
    }
  }, [isMyTurn])

  useEffect(() => {
    if (activeBetAction && allowedActions.every((action) => action.action_type !== activeBetAction.action_type)) {
      setActiveBetAction(primarySliderAction)
      setIsAdjustingBet(false)
    }
  }, [activeBetAction, allowedActions, primarySliderAction])

  useEffect(() => {
    setBetAmount((previous) => clampAmount(previous || minAmount, minAmount, maxAmount))
  }, [minAmount, maxAmount, activeBetAction])

  const sliderPercent = useMemo(() => {
    if (!maxAmount || maxAmount === minAmount) return 0
    return ((betAmount - minAmount) / (maxAmount - minAmount)) * 100
  }, [betAmount, maxAmount, minAmount])

  const labelPercent = clampAmount(sliderPercent, 5, 95)
  const isDisabled = isProcessing || !isMyTurn

  const handleStartAdjusting = (action: AllowedAction | null) => {
    if (!action) return
    const min = action.min_amount ?? 0
    const max = action.max_amount ?? myStack
    setActiveBetAction(action)
    setBetAmount(clampAmount(min || 0, min, max || myStack))
    setIsAdjustingBet(true)
  }

  const handleBetSubmit = (action: AllowedAction | null) => {
    if (!action) return
    onAction(action.action_type, betAmount)
    setIsAdjustingBet(false)
  }

  const centerAction = useMemo(() => {
    if (checkAction) return checkAction
    if (callAction) return callAction
    if (betAction) return betAction
    if (raiseAction) return raiseAction
    return null
  }, [betAction, callAction, checkAction, raiseAction])

  const shouldShowSlider = Boolean(isMyTurn && isAdjustingBet && activeBetAction && sliderActions.includes(activeBetAction.action_type))

  const centerLabel = useMemo(() => {
    if (checkAction) {
      return t('table.actionBar.check', { defaultValue: 'CHECK' }).toUpperCase()
    }

    if (callAction) {
      return `CALL ${formatChips(callAction.amount ?? 0)}`
    }

    return t('table.actionBar.check', { defaultValue: 'CHECK' }).toUpperCase()
  }, [callAction, checkAction, t])

  const sliderLabelAction = raiseAction ?? betAction ?? null
  const sliderLabelAmount = sliderLabelAction
    ? isAdjustingBet && activeBetAction?.action_type === sliderLabelAction.action_type
      ? betAmount
      : sliderLabelAction.min_amount ?? sliderLabelAction.amount ?? betAmount
    : 0
  const sliderLabelText = sliderLabelAction
    ? sliderLabelAction.action_type === 'all_in'
      ? `ALL-IN ${formatChips(sliderLabelAmount ?? 0)}`
      : `RAISE ${formatChips(sliderLabelAmount ?? 0)}`
    : t('table.actionBar.raise', { defaultValue: 'RAISE' }).toUpperCase()

  const handleFold = () => {
    if (!foldAction || !isMyTurn) return
    if (isProcessing) return
    onAction('fold')
    setIsAdjustingBet(false)
  }

  const handleCenter = () => {
    if (!centerAction || isDisabled) return
    if (sliderActions.includes(centerAction.action_type)) {
      if (!isAdjustingBet || activeBetAction?.action_type !== centerAction.action_type) {
        handleStartAdjusting(centerAction)
        return
      }
      handleBetSubmit(centerAction)
      return
    }

    if (centerAction.action_type === 'check') {
      onAction('check')
    } else if (centerAction.action_type === 'call') {
      onAction('call', centerAction.amount)
    }
  }

  const handleRaise = () => {
    if (!sliderLabelAction || isDisabled) return
    if (!isAdjustingBet || activeBetAction?.action_type !== sliderLabelAction.action_type) {
      handleStartAdjusting(sliderLabelAction)
      return
    }
    handleBetSubmit(sliderLabelAction)
  }

  const foldLabel = t('table.actionBar.fold', { defaultValue: 'Fold' }).toUpperCase()
  const foldDisabled = !isMyTurn || !foldAction
  const centerDisabled = isDisabled || (!checkAction && !callAction)
  const raiseDisabled = isDisabled || !sliderLabelAction

  if (!isMyTurn) {
    // Root cause note: disabled fold/raise states were confusing when it wasn't the hero's turn.
    // Render a neutral waiting panel instead of disabled betting controls.
    return (
      <div className="table-action-dock z-40">
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-black/60 px-4 py-3 text-white/80 backdrop-blur-md">
          <Badge variant="info" size="sm">
            {t('table.actions.waitingForTurn', { defaultValue: 'Waiting for opponent…' })}
          </Badge>
          <Button variant="ghost" size="sm" disabled block>
            {t('table.actions.notYourTurn', { defaultValue: 'Not your turn' })}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      {shouldShowSlider && activeBetAction && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:px-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)' }}>
          <div className="relative w-full max-w-[520px]">
            <div className="relative flex flex-col items-center gap-4 pointer-events-auto">
              <div className="w-full max-w-[520px] animate-[fadeInScale_0.18s_ease-out]">
                <div className="relative w-full px-4">
                  <div
                    className="pointer-events-none absolute -top-9"
                    style={{ left: `${labelPercent}%`, transform: 'translateX(-50%)' }}
                  >
                    <div className="rounded-full border border-white/15 bg-[rgba(12,19,38,0.7)] px-3 py-1 text-[12px] font-semibold text-white shadow-[0_0_12px_rgba(74,222,128,0.45)] backdrop-blur-xl">
                      {t('table.actionBar.currentBet', {
                        amount: formatChips(betAmount ?? 0),
                        defaultValue: `${formatChips(betAmount ?? 0)} chips`,
                      })}
                    </div>
                  </div>

                  <input
                    type="range"
                    min={minAmount}
                    max={maxAmount || minAmount || 1}
                    value={betAmount}
                    onChange={(event) => setBetAmount(Number(event.target.value))}
                    disabled={isDisabled}
                    className="action-range"
                    style={{
                      background: `linear-gradient(90deg, rgba(74,222,128,0.9) ${sliderPercent}%, rgba(12,19,38,0.65) ${sliderPercent}%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={clsx('table-action-dock', { 'pointer-events-none opacity-50': !isMyTurn })}>
        <button
          type="button"
          onClick={handleFold}
          disabled={foldDisabled}
          className="flex-1 h-14 rounded-xl bg-rose-600 border-b-4 border-rose-800 text-white font-bold text-lg active:border-b-0 active:translate-y-1 transition-all shadow-lg"
        >
          {foldLabel}
        </button>
        <button
          type="button"
          onClick={handleCenter}
          disabled={centerDisabled}
          className="flex-1 h-14 rounded-xl bg-emerald-600 border-b-4 border-emerald-800 text-white font-bold text-lg active:border-b-0 active:translate-y-1 transition-all shadow-lg"
        >
          {centerLabel}
        </button>
        <button
          type="button"
          onClick={handleRaise}
          disabled={raiseDisabled}
          className="flex-1 h-14 rounded-xl bg-amber-500 border-b-4 border-amber-700 text-white font-bold text-lg active:border-b-0 active:translate-y-1 transition-all shadow-lg"
        >
          {sliderLabelText}
        </button>
      </div>
    </>
  )
}
