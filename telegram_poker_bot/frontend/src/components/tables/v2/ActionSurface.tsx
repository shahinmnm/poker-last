import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ActionBar from '@/components/table/ActionBar'
import InterHandVoting from '@/components/tables/InterHandVoting'

import type { AllowedAction, TablePlayerState } from '@/types/game'

interface ActionSurfaceProps {
  allowedActions: AllowedAction[]
  isMyTurn: boolean
  onAction: (action: AllowedAction['action_type'], amount?: number) => void
  potSize: number
  myStack: number
  isProcessing: boolean
  isInterHand: boolean
  readyPlayerIds: string[]
  players: TablePlayerState[]
  deadline?: string | null
  interHandSeconds?: number | null
  onReady: () => void
  heroId?: string | null
}

export default function ActionSurface({
  allowedActions,
  isMyTurn,
  onAction,
  potSize,
  myStack,
  isProcessing,
  isInterHand,
  readyPlayerIds,
  players,
  deadline,
  interHandSeconds,
  onReady,
  heroId,
}: ActionSurfaceProps) {
  const { t } = useTranslation()

  const content = useMemo(() => {
    if (isInterHand) {
      return (
        <div className="pointer-events-auto mx-auto w-full max-w-2xl px-4 pb-6">
          <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/10 shadow-[0_-12px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <InterHandVoting
              players={players}
              readyPlayerIds={readyPlayerIds}
              deadline={deadline ?? undefined}
              durationSeconds={interHandSeconds ?? 20}
              onReady={onReady}
              isReady={heroId !== null && heroId !== undefined && readyPlayerIds.includes(heroId)}
            />
          </div>
        </div>
      )
    }

    const hasActions = allowedActions.length > 0

    return (
      <div className="pointer-events-auto mx-auto w-full max-w-3xl px-4 pb-7">
        <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/5 shadow-[0_-14px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="flex items-center justify-between bg-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70">
            <span>{isMyTurn ? t('table.actionBar.yourTurnLabel') : t('table.actionBar.sleepLabel', { defaultValue: 'Waiting' })}</span>
            {!isMyTurn && (
              <span className="text-[10px] font-medium text-white/50">
                {t('table.actionBar.waitingHint', { defaultValue: 'Other players acting' })}
              </span>
            )}
          </div>
          {hasActions ? (
            <ActionBar
              allowedActions={allowedActions}
              onAction={onAction}
              potSize={potSize}
              myStack={myStack}
              isProcessing={isProcessing}
              isMyTurn={isMyTurn}
            />
          ) : (
            <div className="px-5 py-6 text-center text-sm text-white/70">
              {t('table.actionBar.noActions', { defaultValue: 'Waiting for next decision...' })}
            </div>
          )}
        </div>
      </div>
    )
  }, [
    allowedActions,
    deadline,
    heroId,
    interHandSeconds,
    isInterHand,
    isMyTurn,
    isProcessing,
    myStack,
    onAction,
    onReady,
    players,
    potSize,
    readyPlayerIds,
    t,
  ])

  return content
}
