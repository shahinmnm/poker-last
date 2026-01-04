import { useEffect, useMemo, useState } from 'react'
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
  isShowdown?: boolean
  isInterHand?: boolean
  heroName?: string
  heroStack?: number
  heroSeatTags?: string[]
  isHeroLeaving?: boolean
  isHeroSittingOut?: boolean
}

const clampAmount = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const multiplierPresets = [2.5, 3, 4] as const

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
  heroName,
  heroStack,
  heroSeatTags,
  isHeroLeaving = false,
  isHeroSittingOut = false,
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

  const heroDisplayName = heroName || t('table.players.youTag', { defaultValue: 'You' })
  const heroStackDisplay = formatChips(heroStack ?? myStack ?? 0)
  const seatTags = useMemo(() => (heroSeatTags ?? []).filter(Boolean).slice(0, 3), [heroSeatTags])

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
  const callLabel = callAction
    ? `${t('table.actions.call', { defaultValue: 'Call' }).toUpperCase()} ${formatChips(callAction.amount ?? 0)}`
    : t('table.actions.call', { defaultValue: 'Call' }).toUpperCase()
  const checkLabel = t('table.actionBar.check', { defaultValue: 'Check' }).toUpperCase()
  const raiseLabel =
    raiseAction?.action_type === 'bet'
      ? t('table.actionBar.betLabel', { defaultValue: 'Bet' }).toUpperCase()
      : t('table.actions.raise', { defaultValue: 'Raise' }).toUpperCase()

  const showWaitingToast = !isMyTurn && !isShowdown && !isInterHand

  return (
    <div className="w-full">
      {showWaitingToast && (
        <div className="mb-2 flex items-center justify-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white/80">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
          {t('table.actions.waitingForTurn', { defaultValue: 'Waiting for opponent' })}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-md flex-col gap-3 rounded-2xl border border-white/10 bg-[#0d1115] p-3 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{heroDisplayName}</span>
            {seatTags.length > 0 && (
              <div className="flex items-center gap-1">
                {seatTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <span className="whitespace-nowrap">{heroStackDisplay}</span>
            {(isHeroLeaving || isHeroSittingOut) && (
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                {isHeroLeaving && (
                  <span className="rounded-md bg-white/10 px-2 py-0.5">
                    {t('table.actions.leavingAfterHand', { defaultValue: 'Leaving' })}
                  </span>
                )}
                {!isHeroLeaving && isHeroSittingOut && (
                  <span className="rounded-md bg-white/10 px-2 py-0.5">
                    {t('table.actions.sittingOut', { defaultValue: 'Sitting out' })}
                  </span>
                )}
              </div>
            )}
            {onToggleStandUp && (
              <button
                type="button"
                onClick={() => onToggleStandUp(!isStandingUp)}
                disabled={standUpProcessing}
                aria-pressed={isStandingUp}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition-colors disabled:opacity-50"
                title={isStandingUp ? t('table.actions.leavingAfterHand', { defaultValue: 'Leaving after hand' }) : undefined}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2" aria-label="Primary actions">
          <button
            type="button"
            onClick={handleFold}
            disabled={!foldAction || isDisabled}
            className="h-12 w-full rounded-xl border border-red-500/40 bg-[#1a1012] text-sm font-semibold uppercase tracking-wide text-red-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="whitespace-nowrap">{foldLabel}</span>
          </button>

          <button
            type="button"
            onClick={handleCallOrCheck}
            disabled={!(checkAction || callAction) || isDisabled}
            className="h-12 w-full rounded-xl border border-emerald-500/50 bg-[#102016] text-sm font-semibold uppercase tracking-wide text-emerald-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="whitespace-nowrap">{checkAction ? checkLabel : callLabel}</span>
          </button>

          <button
            type="button"
            onClick={handleRaise}
            disabled={!hasBetting || isDisabled}
            className="h-12 w-full rounded-xl border border-white/20 bg-[#111722] text-sm font-semibold uppercase tracking-wide text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="whitespace-nowrap">{raiseLabel}</span>
          </button>
        </div>

        {hasBetting && (
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0b0f13] p-3" aria-label="Raise control">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                {raiseLabel}
              </span>
              <span className="text-lg font-bold text-emerald-300 tabular-nums">{formatChips(amount ?? 0)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustAmount(-1)}
                  disabled={isDisabled}
                  aria-label={t('table.actionBar.decreaseAmount', { defaultValue: 'Decrease amount' })}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-[#161b20] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Minus size={18} />
                </button>
                <input
                  type="range"
                  min={minAmount}
                  max={upperBound || minAmount || 1}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  disabled={isDisabled}
                  className="h-2 flex-1 accent-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => adjustAmount(1)}
                  disabled={isDisabled}
                  aria-label={t('table.actionBar.increaseAmount', { defaultValue: 'Increase amount' })}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-[#161b20] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {multiplierPresets.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => applyMultiplier(value)}
                    disabled={isDisabled}
                    className="h-10 w-full rounded-lg border border-white/10 bg-[#121821] text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="whitespace-nowrap">{`${value}×`}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => applyMultiplier('all-in')}
                  disabled={isDisabled}
                  className="h-10 w-full rounded-lg border border-emerald-500/40 bg-[#0f1b13] text-sm font-semibold text-emerald-100 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="whitespace-nowrap">{t('table.actions.allIn', { defaultValue: 'All-in' }).toUpperCase()}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
