import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AllowedAction } from '@/types/game'

interface ActionBarProps {
  allowedActions: AllowedAction[]
  onAction: (action: AllowedAction['action_type'], amount?: number) => void
  isProcessing: boolean
  potSize: number
  myStack: number
  isMyTurn?: boolean
}

const clampAmount = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const formatNumber = (value: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)

export default function ActionBar({
  allowedActions,
  onAction,
  isProcessing,
  potSize,
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
    () =>
      allowedActions.find((action) => ['bet', 'raise', 'all_in'].includes(action.action_type)),
    [allowedActions],
  )

  const minAmount = betAction?.min_amount ?? 0
  const maxAmount = betAction?.max_amount ?? myStack
  const [betAmount, setBetAmount] = useState(() => clampAmount(minAmount || 0, minAmount, maxAmount || myStack))

  useEffect(() => {
    setBetAmount((previous) => clampAmount(previous || minAmount, minAmount, maxAmount))
  }, [minAmount, maxAmount])

  const setQuickAmount = (ratio: number) => {
    if (!betAction) return
    const target = ratio >= 1 ? maxAmount : potSize * ratio
    setBetAmount(clampAmount(Math.round(target), minAmount, maxAmount))
  }

  const handleBetRaise = () => {
    if (!betAction) return
    onAction(betAction.action_type, betAmount)
  }

  const canCheckOrCall = checkAction || callAction
  const sliderActive = Boolean(betAction)
  const callLabel = callAction
    ? t('table.actionBar.call', { amount: formatNumber(callAction.amount ?? 0) })
    : t('table.actionBar.call', { amount: formatNumber(0) })
  const betLabel = betAction?.action_type === 'raise'
    ? t('table.actionBar.raise', { amount: formatNumber(betAmount) })
    : betAction?.action_type === 'all_in'
      ? t('table.actionBar.allIn', { amount: formatNumber(betAmount) })
      : t('table.actionBar.bet', { amount: formatNumber(betAmount) })

  const sliderPercent = useMemo(() => {
    if (!sliderActive || maxAmount === minAmount) return 0
    return ((betAmount - minAmount) / (maxAmount - minAmount)) * 100
  }, [sliderActive, betAmount, maxAmount, minAmount])

  if (!allowedActions.length) {
    return null
  }

  return (
    <div className="px-4 pb-4 sm:px-6">
      <div className="space-y-4 rounded-[20px] border-t border-white/10 bg-white/5 p-4 shadow-[0_-18px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        {sliderActive && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-white/80">
              <span className="font-semibold uppercase tracking-[0.18em]">{t('table.actionBar.adjustLabel')}</span>
              <span className="font-bold text-emerald-200">
                {t('table.actionBar.currentBet', {
                  amount: formatNumber(betAmount),
                  defaultValue: `${formatNumber(betAmount)} chips`,
                })}
              </span>
            </div>
            <input
              type="range"
              min={minAmount}
              max={maxAmount}
              value={betAmount}
              onChange={(event) => setBetAmount(Number(event.target.value))}
              disabled={isProcessing || !isMyTurn}
              className="poker-slider"
              style={{
                background: `linear-gradient(90deg, rgba(56,189,248,0.95) ${sliderPercent}%, rgba(255,255,255,0.18) ${sliderPercent}%)`,
              }}
            />
            <div className="flex flex-wrap gap-2 text-[12px]">
              <button
                type="button"
                onClick={() => setQuickAmount(0.5)}
                disabled={isProcessing || !isMyTurn}
                className="rounded-full border border-white/30 bg-white/10 px-3 py-2 font-semibold text-white shadow-inner transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('table.actionBar.presets.halfPot')}
              </button>
              <button
                type="button"
                onClick={() => setQuickAmount(1)}
                disabled={isProcessing || !isMyTurn}
                className="rounded-full border border-white/30 bg-white/10 px-3 py-2 font-semibold text-white shadow-inner transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('table.actionBar.presets.pot')}
              </button>
              <button
                type="button"
                onClick={() => setQuickAmount(2)}
                disabled={isProcessing || !isMyTurn}
                className="rounded-full border border-white/30 bg-white/10 px-3 py-2 font-semibold text-white shadow-inner transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('table.actionBar.presets.max')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => foldAction && onAction('fold')}
            disabled={isProcessing || !foldAction || !isMyTurn}
            className="h-11 rounded-xl bg-rose-500/90 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('table.actionBar.fold')}
          </button>

          <button
            type="button"
            onClick={() => canCheckOrCall && onAction(checkAction ? 'check' : 'call', callAction?.amount)}
            disabled={isProcessing || !canCheckOrCall || !isMyTurn}
            className="h-11 rounded-xl bg-white/10 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checkAction ? t('table.actionBar.check') : callLabel}
          </button>

          <button
            type="button"
            onClick={handleBetRaise}
            disabled={isProcessing || !betAction || !isMyTurn}
            className="h-11 rounded-xl bg-gradient-to-r from-sky-400 to-cyan-300 text-xs font-bold uppercase tracking-[0.12em] text-[#0a1429] shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {betLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
