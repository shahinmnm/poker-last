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
        <div className="pointer-events-auto mx-auto w-full max-w-xl rounded-t-3xl border border-white/10 bg-black/70 p-4 shadow-2xl backdrop-blur-2xl">
          <InterHandVoting
            players={players}
            readyPlayerIds={readyPlayerIds}
            deadline={deadline ?? undefined}
            durationSeconds={interHandSeconds ?? 20}
            onReady={onReady}
            isReady={heroId !== null && heroId !== undefined && readyPlayerIds.includes(heroId)}
          />
        </div>
      )
    }

    if (isMyTurn && allowedActions.length) {
      return (
        <div className="pointer-events-auto mx-auto w-full max-w-2xl px-3 pb-3">
          <div className="overflow-hidden rounded-3xl border border-white/20 bg-white/30 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
            <div className="bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black/80 mix-blend-screen">
              {t('table.actionBar.yourTurnLabel')}
            </div>
            <ActionBar
              allowedActions={allowedActions}
              onAction={onAction}
              potSize={potSize}
              myStack={myStack}
              isProcessing={isProcessing}
              isMyTurn
            />
          </div>
        </div>
      )
    }

    return null
  }, [allowedActions, deadline, heroId, interHandSeconds, isInterHand, isMyTurn, isProcessing, myStack, onAction, onReady, players, potSize, readyPlayerIds, t])

  return content
}
