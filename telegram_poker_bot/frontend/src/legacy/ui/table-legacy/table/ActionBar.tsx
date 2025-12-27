import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

import { LogOut, Minus, Plus } from 'lucide-react'
import type { AllowedAction } from '@/types/game'
import { formatChips } from '@/utils/formatChips'

interface ActionBarProps {
  allowedActions: AllowedAction[]
  onAction: (action: AllowedAction['action_type'], amount?: number) => void
  isProcessing: boolean
  myStack: number
  isMyTurn?: boolean
  onToggleStandUp?: (standUp: boolean) => void
  isStandingUp?: boolean
  standUpProcessing?: boolean
}

const clampAmount = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const sliderActions: AllowedAction['action_type'][] = ['bet', 'raise', 'all_in']

export default function ActionBar({
  allowedActions,
  onAction,
  isProcessing,
  myStack,
  isMyTurn = false,
  onToggleStandUp,
  isStandingUp = false,
  standUpProcessing = false,
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

  // TASK 3/6: Reset UI state when turn changes or becomes invalid
  useEffect(() => {
    if (!isMyTurn) {
      setIsAdjustingBet(false)
      // Reset bet amount to minimum when not our turn
      if (primarySliderAction) {
        const min = primarySliderAction.min_amount ?? 0
        const max = primarySliderAction.max_amount ?? myStack
        setBetAmount(clampAmount(min || 0, min, max || myStack))
      }
    }
  }, [isMyTurn, primarySliderAction, myStack])

  useEffect(() => {
    if (activeBetAction && allowedActions.every((action) => action.action_type !== activeBetAction.action_type)) {
      setActiveBetAction(primarySliderAction)
      setIsAdjustingBet(false)
    }
  }, [activeBetAction, allowedActions, primarySliderAction])

  useEffect(() => {
    setBetAmount((previous) => clampAmount(previous || minAmount, minAmount, maxAmount))
  }, [minAmount, maxAmount, activeBetAction])

  // TASK 5: DEV-only validation for invalid raise bounds
  useEffect(() => {
    if (import.meta.env.DEV && primarySliderAction) {
      const min = primarySliderAction.min_amount ?? 0
      const max = primarySliderAction.max_amount ?? myStack
      if (max < min && max > 0) {
        console.warn('[ActionBar] Invalid raise bounds detected:', {
          minRaise: min,
          maxRaise: max,
          myStack,
          action: primarySliderAction.action_type,
        })
      }
    }
  }, [primarySliderAction, myStack])

  const sliderPercent = useMemo(() => {
    if (!maxAmount || maxAmount === minAmount) return 0
    return ((betAmount - minAmount) / (maxAmount - minAmount)) * 100
  }, [betAmount, maxAmount, minAmount])

  const labelPercent = clampAmount(sliderPercent, 5, 95)
  const isDisabled = isProcessing || !isMyTurn

  // TASK 3: Add disabled check to prevent actions when not allowed
  const handleStartAdjusting = (action: AllowedAction | null) => {
    // Gate: must be my turn and not processing
    if (!action || isDisabled) return
    const min = action.min_amount ?? 0
    const max = action.max_amount ?? myStack
    // TASK 5: Validate bounds before allowing slider
    if (max > 0 && max < min) {
      if (import.meta.env.DEV) {
        console.debug('[ActionBar] Blocked slider - invalid bounds:', { min, max })
      }
      return
    }
    setActiveBetAction(action)
    setBetAmount(clampAmount(min || 0, min, max || myStack))
    setIsAdjustingBet(true)
  }

  // TASK 3: Add disabled check to bet submission
  const handleBetSubmit = (action: AllowedAction | null) => {
    if (!action || isDisabled) return
    // TASK 7: DEV log submission
    if (import.meta.env.DEV) {
      console.debug('[ActionBar] Submitting bet:', {
        action: action.action_type,
        amount: betAmount,
        isMyTurn,
        isProcessing,
      })
    }
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
  const confirmLabelAmount = formatChips(
    isAdjustingBet ? betAmount ?? sliderLabelAmount ?? 0 : sliderLabelAmount ?? 0,
  )
  const confirmLabel = (
    sliderLabelAction?.action_type === 'all_in'
      ? t('table.actions.allIn', { defaultValue: 'ALL-IN' })
      : t('table.actionBar.raise', { defaultValue: 'Raise {amount}', amount: confirmLabelAmount })
  ).toUpperCase()

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
  const centerDisabled = isDisabled || !centerAction
  const raiseDisabled = isDisabled || !sliderLabelAction

  const renderStandUpButton = () => {
    if (!onToggleStandUp) return null
    const nextState = !isStandingUp
    const activeClasses = isStandingUp
      ? 'bg-amber-400 text-black shadow-amber-500/50 border-amber-300 ring-2 ring-amber-300/70 animate-[pulse_1.6s_ease-in-out_infinite]'
      : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
    const statusDot = (
      <span className="relative flex h-2.5 w-2.5 items-center justify-center">
        {isStandingUp && (
          <span className="absolute inline-flex h-4 w-4 rounded-full bg-amber-500/50 animate-ping" />
        )}
        <span
          className={clsx(
            'relative h-2.5 w-2.5 rounded-full',
            isStandingUp ? 'bg-amber-700' : 'bg-amber-300',
          )}
        />
      </span>
    )

    return (
      <button
        type="button"
        onClick={() => onToggleStandUp(nextState)}
        disabled={standUpProcessing}
        aria-pressed={isStandingUp}
        className={clsx(
          'flex h-9 items-center gap-1.5 rounded-full px-3 text-[10px] font-black uppercase tracking-wide shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
          activeClasses,
        )}
        title={isStandingUp ? t('table.actions.standingUp', { defaultValue: 'Standing Up' }) : t('table.actions.standUp', { defaultValue: 'Stand Up' })}
      >
        {statusDot}
        <LogOut size={16} className={isStandingUp ? 'text-black' : 'text-white'} />
        <span>{isStandingUp ? t('table.actions.standingUp', { defaultValue: 'Standing Up' }) : t('table.actions.standUp', { defaultValue: 'Stand Up' })}</span>
      </button>
    )
  }

  const adjustBet = (direction: 1 | -1, actionOverride?: AllowedAction | null) => {
    const baseAction = actionOverride ?? activeBetAction ?? sliderLabelAction ?? primarySliderAction
    if (!baseAction) return
    const min = baseAction.min_amount ?? 0
    const max = baseAction.max_amount ?? myStack
    const span = Math.max(1, max - min)
    const step = Math.max(1, Math.round(span / 12))

    setActiveBetAction(baseAction)
    setBetAmount((previous) => clampAmount((previous || min) + direction * step, min, max || myStack))
    setIsAdjustingBet(true)
  }

  if (!isMyTurn) {
    const standUpButton = renderStandUpButton()
    return (
      <div
        className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:bottom-5 sm:px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
      >
        <div
          className={clsx(
            'pointer-events-auto flex w-full max-w-[780px] items-center gap-3',
            standUpButton ? 'justify-between' : 'justify-center',
          )}
        >
          <div className="rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-medium text-white/80 shadow-lg backdrop-blur-md">
            {t('table.actions.waitingForTurn', { defaultValue: 'Waiting for opponent…' })}
          </div>
          {standUpButton}
        </div>
      </div>
    )
  }

  return (
    <>
      {shouldShowSlider && activeBetAction && (
        <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-3 sm:bottom-24 sm:px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="pointer-events-auto relative w-full max-w-[520px]">
            <div className="pointer-events-none absolute -top-10" style={{ left: `${labelPercent}%`, transform: 'translateX(-50%)' }}>
              <div className="rounded-full border border-emerald-300/50 bg-emerald-600/90 px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-emerald-900/40 backdrop-blur-lg">
                {t('table.actionBar.currentBet', {
                  amount: formatChips(betAmount ?? 0),
                  defaultValue: `${formatChips(betAmount ?? 0)} chips`,
                })}
              </div>
            </div>

            <div className="rounded-full border border-white/10 bg-black/60 px-3 py-2 shadow-xl backdrop-blur-lg">
              <input
                type="range"
                min={minAmount}
                max={maxAmount || minAmount || 1}
                value={betAmount}
                onChange={(event) => setBetAmount(Number(event.target.value))}
                disabled={isDisabled}
                className="action-range h-2"
                style={{
                  background: `linear-gradient(90deg, rgba(74,222,128,0.95) ${sliderPercent}%, rgba(255,255,255,0.12) ${sliderPercent}%)`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-start px-3 sm:bottom-5 sm:px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="pointer-events-auto max-w-[820px] text-white font-['Inter',_sans-serif]">
          <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-emerald-200/25 bg-white/10 px-2 py-1.5 shadow-xl shadow-emerald-900/30 backdrop-blur-lg">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleFold}
                disabled={foldDisabled}
                className="h-10 rounded-full bg-gradient-to-b from-rose-500 to-rose-700 px-4 text-[13px] font-bold uppercase tracking-wide text-white shadow-lg shadow-rose-900/50 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {foldLabel}
              </button>

              <button
                type="button"
                onClick={handleCenter}
                disabled={centerDisabled}
                className="h-10 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 px-4 text-[13px] font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-900/50 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {centerLabel}
              </button>
            </div>

            {sliderLabelAction && (
              <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/15 px-1.5 py-1 shadow-lg backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => adjustBet(-1, sliderLabelAction)}
                  disabled={raiseDisabled}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <div className="min-w-[64px] px-2 text-center text-[12px] font-semibold text-emerald-300 tabular-nums">
                  {formatChips(isAdjustingBet ? betAmount ?? 0 : sliderLabelAmount ?? 0)}
                </div>
                <button
                  type="button"
                  onClick={() => adjustBet(1, sliderLabelAction)}
                  disabled={raiseDisabled}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleRaise}
                  disabled={raiseDisabled}
                  className="ml-1 h-9 rounded-full bg-emerald-500 px-3 text-[11px] font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-900/50 transition hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                >
                  {confirmLabel}
                </button>
              </div>
            )}

            {renderStandUpButton()}
          </div>
        </div>
      </div>
    </>
  )
}
