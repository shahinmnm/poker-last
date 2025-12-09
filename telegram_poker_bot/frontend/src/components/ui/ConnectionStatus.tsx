import { Loader2, WifiOff } from 'lucide-react'
import type { ConnectionState } from '@/types/normalized'
import { cn } from '@/utils/cn'

interface ConnectionStatusProps {
  state: ConnectionState
  className?: string
}

// Visual indicator for WebSocket health with mobile-friendly motion cues.
export default function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  if (state === 'live') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="relative flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/70 opacity-75 animate-ping" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[11px] font-extrabold tracking-[0.18em] text-emerald-400 uppercase">
          LIVE
        </span>
      </div>
    )
  }

  if (state === 'connecting' || state === 'syncing_snapshot') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
        <span className="text-[11px] font-bold tracking-[0.14em] text-amber-400 uppercase">
          SYNC
        </span>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <WifiOff className="h-4 w-4 text-rose-500" />
      <span className="text-[11px] font-bold tracking-[0.14em] text-rose-500 uppercase">
        OFFLINE
      </span>
    </div>
  )
}
