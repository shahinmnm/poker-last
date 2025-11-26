import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { pokerTokens } from '@/design/tokens'

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

/**
 * Enhanced ActionBar - Poker action controls with refined design
 * - FOLD: neutral/dark styling
 * - CHECK/CALL: primary blue
 * - BET/RAISE: CTA orange/red gradient
 */
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
      <div
        className="space-y-4 rounded-[20px] p-4"
        style={{
          background: pokerTokens.colors.glass.actionBar,
          backdropFilter: `blur(${pokerTokens.effects.blur.xxl})`,
          border: `1px solid ${pokerTokens.colors.border.subtle}`,
          boxShadow: pokerTokens.effects.shadow.elevated,
        }}
      >
        {/* Bet slider */}
        {sliderActive && (
          <div className="space-y-2">
            <div
              className="flex items-center justify-between font-semibold uppercase tracking-wider"
              style={{
                fontSize: pokerTokens.typography.fontSize.xs,
                color: pokerTokens.colors.text.medium,
              }}
            >
              <span>{t('table.actionBar.adjustLabel')}</span>
              <span
                className="font-bold"
                style={{
                  color: '#10b981', // emerald
                }}
              >
                {t('table.actionBar.currentBet', {
                  amount: formatNumber(betAmount),
                  defaultValue: `${formatNumber(betAmount)} chips`,
                })}
              </span>
            </div>

            {/* Slider track */}
            <input
              type="range"
              min={minAmount}
              max={maxAmount}
              value={betAmount}
              onChange={(event) => setBetAmount(Number(event.target.value))}
              disabled={isProcessing || !isMyTurn}
              className="poker-slider w-full"
              style={{
                background: `linear-gradient(90deg, #06b6d4 ${sliderPercent}%, rgba(255,255,255,0.15) ${sliderPercent}%)`,
              }}
            />

            {/* Quick bet buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { ratio: 0.5, label: t('table.actionBar.presets.halfPot') },
                { ratio: 1, label: t('table.actionBar.presets.pot') },
                { ratio: 2, label: t('table.actionBar.presets.max') },
              ].map((preset) => (
                <button
                  key={preset.ratio}
                  type="button"
                  onClick={() => setQuickAmount(preset.ratio)}
                  disabled={isProcessing || !isMyTurn}
                  className="rounded-full px-3 py-1.5 font-semibold transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    fontSize: pokerTokens.typography.fontSize.xs,
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${pokerTokens.colors.border.normal}`,
                    color: pokerTokens.colors.text.high,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          {/* FOLD - Neutral/Dark */}
          <button
            type="button"
            onClick={() => foldAction && onAction('fold')}
            disabled={isProcessing || !foldAction || !isMyTurn}
            className="h-11 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, rgba(100, 116, 139, 0.3) 0%, rgba(71, 85, 105, 0.2) 100%)',
              border: `1px solid ${pokerTokens.colors.border.subtle}`,
              color: pokerTokens.colors.text.medium,
              boxShadow: pokerTokens.effects.shadow.surface,
            }}
          >
            {t('table.actionBar.fold')}
          </button>

          {/* CHECK/CALL - Primary Blue */}
          <button
            type="button"
            onClick={() => canCheckOrCall && onAction(checkAction ? 'check' : 'call', callAction?.amount)}
            disabled={isProcessing || !canCheckOrCall || !isMyTurn}
            className="h-11 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: `linear-gradient(135deg, ${pokerTokens.colors.primary.base} 0%, ${pokerTokens.colors.primary.dark} 100%)`,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: pokerTokens.colors.text.high,
              boxShadow: `${pokerTokens.effects.shadow.glow.primary}, ${pokerTokens.effects.shadow.surface}`,
            }}
          >
            {checkAction ? t('table.actionBar.check') : callLabel}
          </button>

          {/* BET/RAISE - CTA Orange/Red */}
          <button
            type="button"
            onClick={handleBetRaise}
            disabled={isProcessing || !betAction || !isMyTurn}
            className="h-11 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: pokerTokens.colors.cta.gradient,
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: pokerTokens.colors.text.high,
              boxShadow: `${pokerTokens.effects.shadow.glow.cta}, ${pokerTokens.effects.shadow.surface}`,
            }}
          >
            {betLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
