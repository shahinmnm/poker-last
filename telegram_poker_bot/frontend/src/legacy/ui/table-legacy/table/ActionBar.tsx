/**
 * ActionBar - Main poker action UI component
 *
 * SEMANTICS CONTRACT:
 * - call_amount: INCREMENTAL (chips to add to match current bet) - display as "Call {amount}"
 * - min_amount/max_amount for raise/bet: TOTAL-TO (total committed for street)
 *   - For raise actions: display as "Raise to {amount}"
 *   - For bet actions (first bet of street): display as "Bet {amount}"
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

import { LogOut, Minus, Plus } from 'lucide-react'
import type { AllowedAction } from '@/types/game'
import { formatChips } from '@/utils/formatChips'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

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
  const haptic = useHapticFeedback()
  
  // Throttle haptic feedback during rapid slider adjustments
  // Use 200ms interval (max 5 haptics/sec) to avoid UI slowdown and excessive vibration
  const lastHapticTime = useRef(0)
  const throttledHaptic = () => {
    const now = Date.now()
    if (now - lastHapticTime.current > 200) { // Max 5 haptics per second
      haptic.selectionChanged()
      lastHapticTime.current = now
    }
  }

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
  // SEMANTICS: raise/bet amounts are TOTAL-TO values, display as "Raise to {amount}"
  const confirmLabel = (
    sliderLabelAction?.action_type === 'all_in'
      ? t('table.actions.allIn', { defaultValue: 'ALL-IN' })
      : sliderLabelAction?.action_type === 'bet'
        ? t('table.actionBar.bet', { defaultValue: 'Bet {amount}', amount: confirmLabelAmount })
        : t('table.actionBar.raiseTo', { defaultValue: 'Raise to {amount}', amount: confirmLabelAmount })
  ).toUpperCase()

  const handleFold = () => {
    if (!foldAction || !isMyTurn) return
    if (isProcessing) return
    haptic.impact('medium')
    onAction('fold')
    setIsAdjustingBet(false)
  }

  const handleCenter = () => {
    if (!centerAction || isDisabled) return
    if (sliderActions.includes(centerAction.action_type)) {
      if (!isAdjustingBet || activeBetAction?.action_type !== centerAction.action_type) {
        haptic.impact('light')
        handleStartAdjusting(centerAction)
        return
      }
      haptic.notification('success')
      handleBetSubmit(centerAction)
      return
    }

    haptic.impact('light')
    if (centerAction.action_type === 'check') {
      onAction('check')
    } else if (centerAction.action_type === 'call') {
      onAction('call', centerAction.amount)
    }
  }

  const handleRaise = () => {
    if (!sliderLabelAction || isDisabled) return
    if (!isAdjustingBet || activeBetAction?.action_type !== sliderLabelAction.action_type) {
      haptic.impact('light')
      handleStartAdjusting(sliderLabelAction)
      return
    }
    haptic.notification('success')
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
          'flex min-h-[44px] h-10 items-center gap-1.5 rounded-full px-4 text-xs font-black uppercase tracking-wide shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:active:scale-100',
          activeClasses,
        )}
        title={isStandingUp ? t('table.actions.leavingAfterHand', { defaultValue: 'Leaving after hand' }) : t('table.actions.leaveAfterHand', { defaultValue: 'Leave after hand' })}
      >
        {statusDot}
        <LogOut size={18} className={isStandingUp ? 'text-black' : 'text-white'} />
        <span>{isStandingUp ? t('table.actions.leavingAfterHand', { defaultValue: 'Leaving' }) : t('table.actions.leaveAfterHand', { defaultValue: 'Leave' })}</span>
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

    // Throttled haptic feedback on bet adjustment (prevents excessive triggers)
    throttledHaptic()

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
            {/* Floating bet amount label */}
            <div className="pointer-events-none absolute -top-10" style={{ left: `${labelPercent}%`, transform: 'translateX(-50%)' }}>
              <div className="rounded-full border border-emerald-400/60 bg-emerald-600/95 px-4 py-1.5 shadow-lg shadow-emerald-900/50 backdrop-blur-lg">
                <span className="text-[13px] font-bold text-white tabular-nums tracking-tight">
                  {formatChips(betAmount ?? 0)}
                </span>
              </div>
            </div>

            {/* Slider container with min/max labels */}
            <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] px-4 py-3 shadow-xl backdrop-blur-lg">
              {/* Min/Max labels */}
              <div className="flex justify-between mb-2 px-1">
                <span className="text-[10px] font-medium text-[var(--text-3)] uppercase tracking-wider">
                  {t('table.actionBar.min', { defaultValue: 'Min' })}: {formatChips(minAmount ?? 0)}
                </span>
                <span className="text-[10px] font-medium text-[var(--text-3)] uppercase tracking-wider">
                  {t('table.actionBar.max', { defaultValue: 'Max' })}: {formatChips(maxAmount ?? 0)}
                </span>
              </div>
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
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-3 py-2 shadow-xl shadow-emerald-900/30 backdrop-blur-lg">
            <div className="flex flex-wrap items-center gap-2">
              {/* Fold - Secondary action: muted rose, less prominent */}
              <button
                type="button"
                onClick={handleFold}
                disabled={foldDisabled}
                className="action-btn-secondary min-h-[44px] h-11 rounded-full bg-gradient-to-b from-rose-600/80 to-rose-800/80 px-5 text-sm font-bold uppercase tracking-wide text-white/95 shadow-md shadow-rose-900/40 transition-all duration-150 active:scale-[0.97] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-rose-400/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {foldLabel}
              </button>

              {/* Check/Call - Primary action: vibrant emerald, prominent */}
              <button
                type="button"
                onClick={handleCenter}
                disabled={centerDisabled}
                className="action-btn-primary min-h-[44px] h-11 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600 px-6 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-emerald-500/50 ring-2 ring-emerald-300/30 transition-all duration-150 active:scale-[0.97] active:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:ring-0 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2 focus:ring-offset-transparent motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {centerLabel}
              </button>
            </div>

            {sliderLabelAction && (
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] px-2 py-1.5 shadow-lg backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => adjustBet(-1, sliderLabelAction)}
                  disabled={raiseDisabled}
                  className="flex min-h-[44px] min-w-[44px] h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-150 hover:bg-white/20 active:scale-95 active:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Minus size={18} />
                </button>
                <div className="min-w-[72px] px-2 text-center">
                  <span className="block text-[10px] uppercase tracking-wider text-[var(--text-3)] leading-none mb-0.5">
                    {sliderLabelAction.action_type === 'bet' 
                      ? t('table.actionBar.betLabel', { defaultValue: 'Bet' })
                      : t('table.actionBar.raiseToLabel', { defaultValue: 'Raise to' })}
                  </span>
                  <span className="block text-[14px] font-bold text-emerald-300 tabular-nums leading-none">
                    {formatChips(isAdjustingBet ? betAmount ?? 0 : sliderLabelAmount ?? 0)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => adjustBet(1, sliderLabelAction)}
                  disabled={raiseDisabled}
                  className="flex min-h-[44px] min-w-[44px] h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-150 hover:bg-white/20 active:scale-95 active:bg-white/25 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  onClick={handleRaise}
                  disabled={raiseDisabled}
                  className="ml-1 min-h-[44px] h-10 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 px-4 text-[13px] font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400/30 transition-all duration-150 hover:brightness-110 active:scale-[0.97] active:brightness-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:ring-0 focus:outline-none focus:ring-2 focus:ring-blue-400/60 focus:ring-offset-2 focus:ring-offset-transparent whitespace-nowrap motion-reduce:transition-none motion-reduce:active:scale-100"
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
