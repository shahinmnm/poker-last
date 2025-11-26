import { useEffect, useMemo, useState } from 'react'

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
  const { seconds, progress } = useCountdown(deadline, durationSeconds)
  const readyLookup = useMemo(
    () => new Set(readyPlayerIds.map((id) => id.toString())),
    [readyPlayerIds],
  )

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/10 p-5 text-white shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">Next Hand Vote</p>
          <p className="text-xl font-bold">Confirm you're in</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
          <span className="text-lg">⏳</span>
          <span>{seconds}s</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {players.map((player) => {
          const isReadyPlayer = readyLookup.has(player.user_id.toString())
          const statusIcon = isReadyPlayer ? '✅' : '🕒'
          const statusColor = isReadyPlayer ? 'text-emerald-400' : 'text-white/60'
          const statusText = isReadyPlayer ? 'Ready' : 'Waiting to confirm'

          return (
            <div
              key={player.user_id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-white/5 ${statusColor}`}>
                  <span>{statusIcon}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">
                    {player.display_name || player.username || `Player ${player.user_id}`}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-white/60">{statusText}</p>
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
        className="mt-4"
        variant="primary"
        glow
        onClick={onReady}
        disabled={isReady}
      >
        {isReady ? 'Waiting for players...' : 'Join Next Hand'}
      </Button>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-sky-400 transition-[width] duration-150 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
