import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AllowedAction } from '@/types/game'

interface ActionBarProps {
  allowedActions: AllowedAction[]
  onAction: (action: AllowedAction['action_type'], amount?: number) => void
  isProcessing: boolean
  myStack: number
  isMyTurn?: boolean
}

const clampAmount = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const formatNumber = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
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

  const mainLabel = useMemo(() => {
    if (!centerAction) return t('table.actionBar.check')
    if (centerAction.action_type === 'check') return t('table.actionBar.check')
    if (centerAction.action_type === 'call') {
      return t('table.actionBar.call', {
        amount: formatNumber(centerAction.amount ?? 0),
        defaultValue: `Call ${formatNumber(centerAction.amount ?? 0)}`,
      })
    }
    if (centerAction.action_type === 'raise') {
      return t('table.actionBar.raise', {
        amount: formatNumber(betAmount || centerAction.min_amount || 0),
        defaultValue: `Raise to ${formatNumber(betAmount || centerAction.min_amount || 0)}`,
      })
    }
    if (centerAction.action_type === 'all_in') {
      return t('table.actionBar.allIn', {
        amount: formatNumber(betAmount || centerAction.min_amount || 0),
        defaultValue: `All-in ${formatNumber(betAmount || centerAction.min_amount || 0)}`,
      })
    }
    return t('table.actionBar.bet', {
      amount: formatNumber(betAmount || centerAction.min_amount || 0),
      defaultValue: `Bet ${formatNumber(betAmount || centerAction.min_amount || 0)}`,
    })
  }, [betAmount, centerAction, t])

  const raiseLabel = useMemo(() => {
    if (!raiseAction) return t('table.actionBar.raise', { amount: formatNumber(0), defaultValue: 'Raise' })
    const labelAmount = isAdjustingBet && activeBetAction?.action_type === raiseAction.action_type
      ? betAmount
      : raiseAction.min_amount ?? raiseAction.amount ?? betAmount
    const key = raiseAction.action_type === 'all_in' ? 'table.actionBar.allIn' : 'table.actionBar.raise'
    return t(key, {
      amount: formatNumber(labelAmount ?? 0),
      defaultValue: `${raiseAction.action_type === 'all_in' ? 'All-in' : 'Raise'} ${formatNumber(labelAmount ?? 0)}`,
    })
  }, [activeBetAction?.action_type, betAmount, isAdjustingBet, raiseAction, t])

  const renderCircularButton = (
    options: {
      onClick: () => void
      icon: JSX.Element
      label: string
      disabled?: boolean
      tone: 'danger' | 'primary' | 'warning'
      size: 'small' | 'large'
      offset?: 'lowered' | 'none'
    },
  ) => {
    const tones: Record<typeof options.tone, { bg: string; shadow: string }> = {
      danger: {
        bg: 'bg-[rgba(255,120,80,0.5)]',
        shadow: 'shadow-[0_0_18px_rgba(255,120,80,0.8),0_10px_25px_rgba(0,0,0,0.35)]',
      },
      primary: {
        bg: 'bg-[rgba(0,220,140,0.5)]',
        shadow: 'shadow-[0_0_18px_rgba(0,220,140,0.8),0_10px_25px_rgba(0,0,0,0.35)]',
      },
      warning: {
        bg: 'bg-[rgba(255,200,80,0.5)]',
        shadow: 'shadow-[0_0_18px_rgba(255,200,80,0.8),0_10px_25px_rgba(0,0,0,0.35)]',
      },
    }

    const sizes: Record<typeof options.size, string> = {
      small: 'h-14 w-14 text-base',
      large: 'h-[72px] w-[72px] text-xl',
    }

    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={options.onClick}
          disabled={options.disabled}
          className={`relative flex items-center justify-center rounded-full ${tones[options.tone].bg} ${tones[options.tone].shadow} ${sizes[options.size]} ${options.offset === 'lowered' ? 'translate-y-1.5' : ''} text-white backdrop-blur-xl transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`}
        >
          <span className="absolute inset-0 rounded-full bg-white/5" />
          <span className="relative">{options.icon}</span>
        </button>
        <span className="text-center text-[12px] font-semibold leading-tight text-white drop-shadow-md">{options.label}</span>
      </div>
    )
  }

  const handleFold = () => {
    if (!foldAction || isDisabled) return
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
    if (!raiseAction || isDisabled) return
    if (!isAdjustingBet || activeBetAction?.action_type !== raiseAction.action_type) {
      handleStartAdjusting(raiseAction)
      return
    }
    handleBetSubmit(raiseAction)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:px-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4px)' }}>
      <div className="relative w-full max-w-[520px]">
        <div className="relative flex flex-col items-center gap-4 pointer-events-auto">
          {shouldShowSlider && activeBetAction && (
            <div className="w-full max-w-[520px] animate-[fadeInScale_0.18s_ease-out]">
              <div className="relative w-full px-4">
                <div
                  className="pointer-events-none absolute -top-9"
                  style={{ left: `${labelPercent}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="rounded-full border border-white/15 bg-[rgba(12,19,38,0.7)] px-3 py-1 text-[12px] font-semibold text-white shadow-[0_0_12px_rgba(74,222,128,0.45)] backdrop-blur-xl">
                    {t('table.actionBar.currentBet', {
                      amount: formatNumber(betAmount),
                      defaultValue: `${formatNumber(betAmount)} chips`,
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
          )}

          <div
            className={`flex items-end justify-center gap-8 ${!isMyTurn ? 'pointer-events-none opacity-50' : ''}`}
          >
            {renderCircularButton({
              onClick: handleFold,
              icon: <FontAwesomeIcon icon={faChevronDown} />,
              label: t('table.actionBar.fold'),
              disabled: isDisabled || !foldAction,
              tone: 'danger',
              size: 'small',
              offset: 'lowered',
            })}

            {renderCircularButton({
              onClick: handleCenter,
              icon: <FontAwesomeIcon icon={faArrowRight} />,
              label: mainLabel,
              disabled: isDisabled || !centerAction,
              tone: 'primary',
              size: 'large',
              offset: 'none',
            })}

            {renderCircularButton({
              onClick: handleRaise,
              icon: <FontAwesomeIcon icon={faChevronUp} />,
              label: raiseLabel,
              disabled: isDisabled || !raiseAction,
              tone: 'warning',
              size: 'small',
              offset: 'lowered',
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
