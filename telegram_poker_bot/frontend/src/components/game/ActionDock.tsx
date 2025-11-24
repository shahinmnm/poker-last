import { useEffect, useMemo, useState } from 'react'

export interface AllowedAction {
  action_type: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all_in' | 'ready'
  amount?: number
  min_amount?: number
  max_amount?: number
}

interface ActionDockProps {
  allowedActions: AllowedAction[]
  onAction: (action: AllowedAction['action_type'], amount?: number) => void
  isProcessing: boolean
  potSize: number
  myStack: number
  isMyTurn?: boolean
}

const formatChips = (value?: number) =>
  typeof value === 'number' ? `${value.toLocaleString()} chips` : '0 chips'

const clampAmount = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export default function ActionDock({
  allowedActions,
  onAction,
  isProcessing,
  potSize,
  myStack,
  isMyTurn = true,
}: ActionDockProps) {
  // Log component mount
  useEffect(() => {
    console.log('[ActionDock] Component mounted', {
      allowedActionsCount: allowedActions.length,
      actionTypes: allowedActions.map(a => a.action_type),
      isMyTurn,
      isProcessing,
    })
    return () => {
      console.log('[ActionDock] Component unmounted')
    }
  }, [])

  // Log when props change
  useEffect(() => {
    console.log('[ActionDock] Props updated', {
      allowedActionsCount: allowedActions.length,
      actionTypes: allowedActions.map(a => a.action_type),
      isMyTurn,
      isProcessing,
      potSize,
      myStack,
    })
  }, [allowedActions, isMyTurn, isProcessing, potSize, myStack])

  const canFold = useMemo(
    () => allowedActions.find((action) => action.action_type === 'fold'),
    [allowedActions],
  )
  const canCheck = useMemo(
    () => allowedActions.find((action) => action.action_type === 'check'),
    [allowedActions],
  )
  const canCall = useMemo(
    () => allowedActions.find((action) => action.action_type === 'call'),
    [allowedActions],
  )
  const canBet = useMemo(
    () =>
      allowedActions.find((action) =>
        ['bet', 'raise', 'all_in'].includes(action.action_type),
      ),
    [allowedActions],
  )
  const canReady = useMemo(
    () => allowedActions.find((action) => action.action_type === 'ready'),
    [allowedActions],
  )

  const minAmount = canBet?.min_amount ?? 0
  const maxAmount = canBet?.max_amount ?? myStack
  const [betAmount, setBetAmount] = useState(Math.max(minAmount, 0))

  useEffect(() => {
    setBetAmount((previous) => clampAmount(previous || minAmount, minAmount, maxAmount))
  }, [minAmount, maxAmount])

  const setQuickAmount = (ratio: number) => {
    if (!canBet) return
    const target = ratio >= 1 ? maxAmount : potSize * ratio
    setBetAmount(clampAmount(Math.round(target), minAmount, maxAmount))
  }

  if (!allowedActions.length) {
    console.log('[ActionDock] Hidden: no allowed actions')
    return null
  }

  if (canReady) {
    console.log('[ActionDock] Showing ready button')
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center pb-8 pointer-events-none">
        <button
          type="button"
          onClick={() => onAction('ready')}
          disabled={isProcessing}
          className="pointer-events-auto min-w-[260px] rounded-full bg-emerald-500 px-8 py-4 text-xl font-black uppercase tracking-wide text-black shadow-2xl shadow-emerald-500/50 transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          I’M READY
        </button>
      </div>
    )
  }

  const handleBetRaise = () => {
    if (!canBet) return
    onAction(canBet.action_type, betAmount)
  }

  const canCheckOrCall = canCheck || canCall
  const showSlider = Boolean(canBet)
  const callLabel = canCall?.amount ? `CALL ${formatChips(canCall.amount)}` : 'CALL'
  const betLabel = canBet?.action_type === 'raise' ? 'RAISE' : canBet?.action_type === 'all_in' ? 'ALL IN' : 'BET'

  console.log('[ActionDock] Showing action buttons', {
    canFold: !!canFold,
    canCheck: !!canCheck,
    canCall: !!canCall,
    canBet: !!canBet,
  })

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto bg-gradient-to-t from-black via-black/90 to-transparent backdrop-blur-md px-4 pt-4 pb-6">
        {showSlider && (
          <div className="max-w-4xl mx-auto mb-3">
            <div className="flex items-center justify-between mb-2 text-xs text-white/70">
              <span>Adjust {betLabel.toLowerCase()} amount</span>
              <span className="font-semibold text-white">{formatChips(betAmount)}</span>
            </div>
            <input
              type="range"
              min={minAmount}
              max={maxAmount}
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              disabled={isProcessing || !isMyTurn}
              className="w-full accent-emerald-400"
            />
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setQuickAmount(0.5)}
                disabled={isProcessing || !isMyTurn}
                className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white shadow-inner transition active:scale-95 disabled:opacity-50"
              >
                1/2 Pot
              </button>
              <button
                type="button"
                onClick={() => setQuickAmount(1)}
                disabled={isProcessing || !isMyTurn}
                className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white shadow-inner transition active:scale-95 disabled:opacity-50"
              >
                Pot
              </button>
              <button
                type="button"
                onClick={() => setQuickAmount(2)}
                disabled={isProcessing || !isMyTurn}
                className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-white shadow-inner transition active:scale-95 disabled:opacity-50"
              >
                Max
              </button>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => canFold && onAction('fold')}
            disabled={isProcessing || !canFold || !isMyTurn}
            className="h-14 rounded-2xl bg-gradient-to-br from-red-500/80 to-red-600/90 text-white font-black uppercase tracking-wide shadow-lg shadow-red-500/30 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            Fold
          </button>

          <button
            type="button"
            onClick={() => canCheckOrCall && onAction(canCheck ? 'check' : 'call', canCall?.amount)}
            disabled={isProcessing || !canCheckOrCall || !isMyTurn}
            className="h-14 rounded-2xl bg-white/10 text-white font-black uppercase tracking-wide shadow-md border border-white/10 backdrop-blur transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {canCheck ? 'Check' : callLabel}
          </button>

          <button
            type="button"
            onClick={handleBetRaise}
            disabled={isProcessing || !canBet || !isMyTurn}
            className="h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-black font-black uppercase tracking-wide shadow-xl shadow-emerald-500/40 backdrop-blur transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {betLabel} {showSlider ? formatChips(betAmount) : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
