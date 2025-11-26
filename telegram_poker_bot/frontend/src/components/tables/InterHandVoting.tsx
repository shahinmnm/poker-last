import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from '../ui/Button'

interface VotingPlayer {
  user_id: number | string
  display_name?: string | null
  username?: string | null
}

interface InterHandVotingProps {
  players: VotingPlayer[]
  readyPlayerIds: Array<number | string>
  deadline?: string | null
  durationSeconds: number
  onReady: () => void
  isReady: boolean
}

function useCountdown(deadline: string | null | undefined, durationSeconds: number) {
  const durationMs = useMemo(() => Math.max(1, durationSeconds * 1000), [durationSeconds])
  const [remainingMs, setRemainingMs] = useState(durationMs)

  const target = useMemo(() => {
    const parsedDeadline = deadline ? new Date(deadline).getTime() : null
    return parsedDeadline ?? Date.now() + durationMs
  }, [deadline, durationMs])

  useEffect(() => {
    const updateRemaining = () => {
      const msLeft = Math.max(0, target - Date.now())
      setRemainingMs(msLeft)
    }

    updateRemaining()
    const interval = window.setInterval(updateRemaining, 150)
    return () => window.clearInterval(interval)
  }, [target])

  const seconds = Math.ceil(remainingMs / 1000)
  const progress = Math.min(100, Math.max(0, (remainingMs / durationMs) * 100))

  return { seconds, progress }
}

export default function InterHandVoting({
  players,
  readyPlayerIds,
  deadline,
  durationSeconds,
  onReady,
  isReady,
}: InterHandVotingProps) {
  const { t } = useTranslation()
  const { seconds, progress } = useCountdown(deadline, durationSeconds)
  const readyLookup = useMemo(
    () => new Set(readyPlayerIds.map((id) => id.toString())),
    [readyPlayerIds],
  )

  return (
    <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-gradient-to-b from-white/12 to-white/6 p-5 text-white shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.26em] text-white/60">
            {t('table.interHand.title', { defaultValue: 'Next hand vote' })}
          </p>
          <p className="text-xl font-semibold text-white">{t('table.interHand.subtitle', { defaultValue: "Confirm you're in" })}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-200/10 px-3 py-1 text-sm font-semibold text-amber-100 shadow-inner">
          <span className="text-lg">⏳</span>
          <span>{seconds}s</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {players.map((player) => {
          const isReadyPlayer = readyLookup.has(player.user_id.toString())
          const statusIcon = isReadyPlayer ? '✅' : '🕒'
          const statusColor = isReadyPlayer ? 'text-emerald-300' : 'text-white/60'
          const statusText = isReadyPlayer
            ? t('table.interHand.ready', { defaultValue: 'Ready' })
            : t('table.interHand.waiting', { defaultValue: 'Waiting to confirm' })

          return (
            <div
              key={player.user_id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 shadow-inner"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ${statusColor}`}>
                  <span>{statusIcon}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">
                    {player.display_name || player.username || `Player ${player.user_id}`}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">{statusText}</p>
                </div>
              </div>
              <span className={`text-lg ${statusColor}`}>{statusIcon}</span>
            </div>
          )
        })}
      </div>

      <Button
        block
        size="lg"
        className="mt-5"
        variant="primary"
        glow
        onClick={onReady}
        disabled={isReady}
      >
        {isReady
          ? t('table.interHand.waitingOthers', { defaultValue: 'Waiting for players…' })
          : t('table.interHand.joinNext', { defaultValue: 'Join next hand' })}
      </Button>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-sky-400 transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
