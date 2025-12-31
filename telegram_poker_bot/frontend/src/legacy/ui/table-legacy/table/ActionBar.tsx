/**
 * ActionBar - Main poker action UI component
 *
 * ARCHITECTURE (Phase 5 + Beta Safety Pass):
 * - Minimal Strip: 48-56px height, always visible when seated
 *   - Contains: Fold, Check/Call, Raise (verb), Leave toggle
 * - Micro Strip: 44-48px height, shown during SHOWDOWN
 *   - Contains: Leave toggle only (safe controls)
 *   - No betting actions (Fold/Call/Raise hidden)
 * - Expanded Panel: Opens on Raise tap, contains slider/presets
 *   - Auto-closes after action submission
 *   - Dismissible with X button, tap-outside, or Escape key
 *   - Auto-closes on mode transition (SHOWDOWN/OPPONENT_ACTION)
 *
 * OVERLAY PRIORITY (useUIMode):
 * - SHOWDOWN: micro strip visible (safe controls only), winner visible
 * - PLAYER_ACTION: strip + panel enabled
 * - OPPONENT_ACTION: strip disabled, waiting toast allowed
 * - WAITING: strip hidden if not seated
 *
 * SEMANTICS CONTRACT:
 * - call_amount: INCREMENTAL (chips to add to match current bet) - display as "Call {amount}"
 * - min_amount/max_amount for raise/bet: TOTAL-TO (total committed for street)
 *   - For raise actions: display as "Raise to {amount}"
 *   - For bet actions (first bet of street): display as "Bet {amount}"
 */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'

import { LogOut, Minus, Plus, X, ChevronUp } from 'lucide-react'
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
  /** Is the hand in showdown phase - suppresses waiting toast */
  isShowdown?: boolean
  /** Is inter-hand waiting period - suppresses waiting toast */
  isInterHand?: boolean
}

const clampAmount = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const sliderActions: AllowedAction['action_type'][] = ['bet', 'raise', 'all_in']
const railIconSize = 14
const railSafePadding = 'calc(env(safe-area-inset-bottom, 0px) + var(--hero-identity-reserved, 26px))'

export default function ActionBar({
  allowedActions,
  onAction,
  isProcessing,
  myStack,
  isMyTurn = false,
  onToggleStandUp,
  isStandingUp = false,
  standUpProcessing = false,
  isShowdown = false,
  isInterHand = false,
}: ActionBarProps) {
  const { t } = useTranslation()
  const haptic = useHapticFeedback()
  
  // PHASE 2: Expanded panel state - opens when user taps Raise
  const [isExpanded, setIsExpanded] = useState(false)
  
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
  
  // PHASE 2: Collapse expanded panel when turn changes
  const collapsePanel = useCallback(() => {
    setIsExpanded(false)
    setIsAdjustingBet(false)
  }, [])
  
  // PHASE 2: Auto-close panel on showdown or opponent action mode change
  useEffect(() => {
    if (isShowdown || !isMyTurn) {
      collapsePanel()
    }
  }, [isShowdown, isMyTurn, collapsePanel])
  
  // PHASE 2: Escape key closes expanded panel (desktop)
  useEffect(() => {
    if (!isExpanded) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        collapsePanel()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isExpanded, collapsePanel])

  // TASK 3/6: Reset UI state when turn changes or becomes invalid
  useEffect(() => {
    if (!isMyTurn) {
      collapsePanel()
      // Reset bet amount to minimum when not our turn
      if (primarySliderAction) {
        const min = primarySliderAction.min_amount ?? 0
        const max = primarySliderAction.max_amount ?? myStack
        setBetAmount(clampAmount(min || 0, min, max || myStack))
      }
    }
  }, [isMyTurn, primarySliderAction, myStack, collapsePanel])

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
  // SEMANTICS: raise/bet amounts are TOTAL-TO values
  // Button shows only action verb (no amount) - amount is shown in the center cluster
  const confirmLabel = (
    sliderLabelAction?.action_type === 'all_in'
      ? t('table.actions.allIn', { defaultValue: 'ALL-IN' })
      : sliderLabelAction?.action_type === 'bet'
        ? t('table.actionBar.betLabel', { defaultValue: 'Bet' })
        : t('table.actions.raise', { defaultValue: 'Raise' })
  ).toUpperCase()

  const handleFold = () => {
    if (!foldAction || !isMyTurn) return
    if (isProcessing) return
    haptic.impact('medium')
    onAction('fold')
    collapsePanel()
  }

  const handleCenter = () => {
    if (!centerAction || isDisabled) return
    if (sliderActions.includes(centerAction.action_type)) {
      // Open expanded panel for bet/raise
      if (!isExpanded) {
        haptic.impact('light')
        setIsExpanded(true)
        handleStartAdjusting(centerAction)
        return
      }
      // If expanded, submit the bet
      haptic.notification('success')
      handleBetSubmit(centerAction)
      collapsePanel()
      return
    }

    haptic.impact('light')
    if (centerAction.action_type === 'check') {
      onAction('check')
    } else if (centerAction.action_type === 'call') {
      onAction('call', centerAction.amount)
    }
    collapsePanel()
  }

  // PHASE 1: Raise button in minimal strip opens expanded panel
  const handleRaiseClick = () => {
    if (!sliderLabelAction || isDisabled) return
    haptic.impact('light')
    setIsExpanded(true)
    handleStartAdjusting(sliderLabelAction)
  }

  // PHASE 2: Submit raise from expanded panel
  const handleRaiseSubmit = () => {
    if (!sliderLabelAction || isDisabled) return
    if (!isAdjustingBet) {
      handleStartAdjusting(sliderLabelAction)
      return
    }
    haptic.notification('success')
    handleBetSubmit(sliderLabelAction)
    collapsePanel()
  }

  const foldLabel = t('table.actionBar.fold', { defaultValue: 'Fold' }).toUpperCase()
  const foldDisabled = !isMyTurn || !foldAction
  const centerDisabled = isDisabled || !centerAction
  const raiseDisabled = isDisabled || !sliderLabelAction

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

  // PHASE 4: Waiting toast suppression during showdown
  // Only show waiting toast when: NOT showdown AND NOT inter-hand AND NOT my turn
  const showWaitingToast = !isMyTurn && !isShowdown && !isInterHand

  // PHASE 4: Compact leave toggle for minimal strip (integrated, not separate chip)
  const renderLeaveToggle = () => {
    if (!onToggleStandUp) return null
    const nextState = !isStandingUp
    
    return (
      <button
        type="button"
        onClick={() => onToggleStandUp(nextState)}
        disabled={standUpProcessing}
        aria-pressed={isStandingUp}
        className={clsx(
          'rail-chip rail-chip--ghost ui-focus-ring'
        )}
        title={isStandingUp ? t('table.actions.leavingAfterHand', { defaultValue: 'Leaving after hand' }) : t('table.actions.leaveAfterHand', { defaultValue: 'Leave after hand' })}
      >
        <LogOut size={railIconSize} className={isStandingUp ? 'text-black' : 'text-white/80'} />
        <span className="hidden sm:inline rail-chip__label action-label-safe">
          {isStandingUp 
            ? t('table.actions.leaving', { defaultValue: 'Leaving' })
            : t('table.actions.sitOut', { defaultValue: 'Leave' })}
        </span>
      </button>
    )
  }

  // PHASE 3: When not my turn - show minimal disabled strip or waiting UI
  if (!isMyTurn) {
    return (
      <>
        {/* Waiting toast - centered above action bar safe zone */}
        {/* PHASE 3: Only shown in OPPONENT_ACTION mode (NOT showdown, NOT inter-hand) */}
        {showWaitingToast && (
          <div className="waiting-toast">
            <span className="waiting-toast__spinner" />
            {t('table.actions.waitingForTurn', { defaultValue: 'Waiting for opponent…' })}
          </div>
        )}
        
        {/* PHASE 1 REFACTOR: Thin micro strip - always show safe controls */}
        {/* During showdown: show compact strip with leave toggle (no betting actions) */}
        {/* During opponent action: show minimal strip with leave toggle */}
        <div
          className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-4 sm:px-4"
          style={{ paddingBottom: railSafePadding }}
        >
          <div className="pointer-events-auto w-full flex justify-center">
            <div className={clsx('action-rail', isShowdown && 'action-rail--muted')}>
              <div className="action-rail__group action-rail__group--secondary">
                <div className="rail-hitbox rail-hitbox--secondary">
                  {renderLeaveToggle()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // PHASE 1 & 2: Main rendering when it's my turn
  return (
    <>
      {/* PHASE 2: Backdrop for tap-outside-closes-panel */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={collapsePanel}
          aria-hidden="true"
        />
      )}
      
      {/* PHASE 2: Expanded Action Panel - opens above minimal strip */}
      {/* Only visible when isExpanded is true (user tapped Raise) */}
      {isExpanded && sliderLabelAction && (
        <div
          className="action-expanded-panel pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-3 sm:bottom-24 sm:px-4"
          style={{ paddingBottom: railSafePadding }}
        >
          <div className="pointer-events-auto relative w-full max-w-[var(--expanded-panel-max-width,400px)]">
            {/* Floating bet amount label */}
            <div className="pointer-events-none absolute -top-10" style={{ left: `${labelPercent}%`, transform: 'translateX(-50%)' }}>
              <div className="rounded-full border border-emerald-400/60 bg-emerald-600/95 px-4 py-1.5 shadow-lg shadow-emerald-900/50 backdrop-blur-lg">
                <span className="text-[13px] font-bold text-white tabular-nums tracking-tight">
                  {formatChips(betAmount ?? 0)}
                </span>
              </div>
            </div>

            {/* Expanded panel container */}
            <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] p-4 shadow-xl backdrop-blur-lg">
              {/* Close button */}
              <button
                type="button"
                onClick={collapsePanel}
                aria-label={t('common.cancel', { defaultValue: 'Close' })}
                className="absolute top-2 right-2 min-h-[36px] min-w-[36px] h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 motion-reduce:transition-none"
              >
                <X size={16} />
              </button>
              
              {/* Raise cluster - +/- buttons with amount display */}
              <div className="flex items-center justify-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => adjustBet(-1, sliderLabelAction)}
                  disabled={raiseDisabled}
                  aria-label={t('table.actionBar.decreaseAmount', { defaultValue: 'Decrease amount' })}
                  className="raise-cluster__btn flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-150 hover:bg-white/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Minus size={20} />
                </button>
                
                {/* Amount display */}
                <div className="raise-cluster__amount min-w-[100px] px-3 text-center">
                  <span className="raise-cluster__label block text-[10px] uppercase tracking-wider text-[var(--text-3)] leading-none mb-1">
                    {sliderLabelAction.action_type === 'bet' 
                      ? t('table.actionBar.betLabel', { defaultValue: 'Bet' })
                      : t('table.actionBar.raiseToLabel', { defaultValue: 'Raise to' })}
                  </span>
                  <span className="raise-cluster__value block text-[22px] font-bold text-emerald-300 tabular-nums leading-none">
                    {formatChips(betAmount ?? 0)}
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => adjustBet(1, sliderLabelAction)}
                  disabled={raiseDisabled}
                  aria-label={t('table.actionBar.increaseAmount', { defaultValue: 'Increase amount' })}
                  className="raise-cluster__btn flex min-h-[44px] min-w-[44px] h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all duration-150 hover:bg-white/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              {/* Slider */}
              <div className="mb-3">
                <div className="flex justify-between mb-1.5 px-1">
                  <span className="text-[9px] font-medium text-[var(--text-3)] uppercase tracking-wider">
                    {t('table.actionBar.min', { defaultValue: 'Min' })}: {formatChips(minAmount ?? 0)}
                  </span>
                  <span className="text-[9px] font-medium text-[var(--text-3)] uppercase tracking-wider">
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
                  className="action-range h-2 w-full"
                  style={{
                    background: `linear-gradient(90deg, rgba(74,222,128,0.95) ${sliderPercent}%, rgba(255,255,255,0.12) ${sliderPercent}%)`,
                  }}
                />
              </div>
              
              {/* Confirm button */}
              <button
                type="button"
                onClick={handleRaiseSubmit}
                disabled={raiseDisabled}
                className="w-full min-h-[44px] h-11 rounded-full bg-gradient-to-b from-blue-500 to-blue-700 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-blue-900/50 ring-1 ring-blue-400/30 transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <span className="action-label-safe">{confirmLabel}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 1 REFACTOR: Thin Action Rail - compact visual with preserved 44px tap targets */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-4 sm:px-4"
        style={{ paddingBottom: railSafePadding }}
      >
        <div className="pointer-events-auto w-full flex justify-center">
          <div className="action-rail">
            <div className="action-rail__group action-rail__group--primary">
              <div className="rail-hitbox">
                <button
                  type="button"
                  onClick={handleFold}
                  disabled={foldDisabled}
                  className="rail-chip rail-chip--danger ui-focus-ring"
                >
                  <span className="rail-chip__label action-label-safe">{foldLabel}</span>
                </button>
              </div>

              <div className="rail-hitbox">
                <button
                  type="button"
                  onClick={handleCenter}
                  disabled={centerDisabled}
                  className="rail-chip rail-chip--primary ui-focus-ring"
                >
                  <span className="rail-chip__label action-label-safe">{centerLabel}</span>
                </button>
              </div>

              {sliderLabelAction && (
                <div className="rail-hitbox">
                  <button
                    type="button"
                    onClick={handleRaiseClick}
                    disabled={raiseDisabled}
                    className={clsx(
                      'rail-chip rail-chip--accent ui-focus-ring',
                      isExpanded && 'rail-chip--active'
                    )}
                  >
                    <span className="flex items-center gap-1">
                      <span className="rail-chip__label action-label-safe">
                        {sliderLabelAction.action_type === 'bet'
                          ? t('table.actionBar.betLabel', { defaultValue: 'Bet' }).toUpperCase()
                          : t('table.actions.raise', { defaultValue: 'Raise' }).toUpperCase()}
                      </span>
                      <ChevronUp size={railIconSize} className={clsx('transition-transform duration-150 motion-reduce:transition-none', isExpanded && 'rotate-180')} />
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="action-rail__divider" aria-hidden="true" />

            <div className="action-rail__group action-rail__group--secondary">
              <div className="rail-hitbox rail-hitbox--secondary">
                {renderLeaveToggle()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
