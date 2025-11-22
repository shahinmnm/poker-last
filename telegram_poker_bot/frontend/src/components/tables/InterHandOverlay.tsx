import { useEffect, useMemo, useState } from 'react'

interface InterHandPlayer {
  user_id: number
  display_name?: string | null
}

interface InterHandOverlayProps {
  players: InterHandPlayer[]
  readyPlayerIds: number[]
  deadline?: string | null
  durationSeconds: number
  onReady: () => void
  isReady: boolean
}

function useCountdown(deadline: string | null | undefined, durationSeconds: number) {
  const [remainingMs, setRemainingMs] = useState(durationSeconds * 1000)

  const target = useMemo(() => {
    const deadlineMs = deadline ? new Date(deadline).getTime() : null
    if (deadlineMs) return deadlineMs
    return Date.now() + durationSeconds * 1000
  }, [deadline, durationSeconds])

  useEffect(() => {
    const updateRemaining = () => {
      const msLeft = Math.max(0, target - Date.now())
      setRemainingMs(msLeft)
    }

    updateRemaining()
    const interval = window.setInterval(updateRemaining, 150)
    return () => window.clearInterval(interval)
  }, [target])

  const durationMs = Math.max(1, durationSeconds * 1000)
  const seconds = Math.ceil(remainingMs / 1000)
  const progress = Math.min(100, Math.max(0, (remainingMs / durationMs) * 100))

  return { seconds, progress }
}

export default function InterHandOverlay({
  players,
  readyPlayerIds,
  deadline,
  durationSeconds,
  onReady,
  isReady,
}: InterHandOverlayProps) {
  const { seconds, progress } = useCountdown(deadline, durationSeconds)

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center bg-gradient-to-b from-black/40 via-black/30 to-transparent backdrop-blur-sm">
      <div className="pointer-events-auto mt-6 w-full max-w-xl rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">Next Hand</p>
            <p className="text-2xl font-bold text-white">Get ready to play</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white">
            <span className="text-lg">⏳</span>
            <span>{seconds}s</span>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-sky-400 transition-[width] duration-150 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {players.map((player) => {
            const isPlayerReady = readyPlayerIds.includes(player.user_id)
            return (
              <div
                key={player.user_id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
              >
                <span className={`text-lg ${isPlayerReady ? 'text-emerald-400' : 'text-white/60'}`}>
                  {isPlayerReady ? '✅' : '🕒'}
                </span>
                <span className="truncate text-sm font-medium text-white/90">{player.display_name || `Player ${player.user_id}`}</span>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onReady}
          disabled={isReady}
          className="mt-4 w-full rounded-xl bg-emerald-500/90 px-4 py-3 text-center text-base font-bold uppercase tracking-wide text-black shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/70 disabled:shadow-none"
        >
          {isReady ? 'Waiting for others…' : 'Join Next Hand'}
        </button>
      </div>
    </div>
  )
}
