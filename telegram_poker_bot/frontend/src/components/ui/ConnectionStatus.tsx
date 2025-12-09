import { Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ConnectionStatusProps {
  state: 'live' | 'connecting' | 'disconnected' | 'syncing_snapshot' | 'version_mismatch'
  className?: string
}

export const ConnectionStatus = ({ state, className }: ConnectionStatusProps) => {
  if (state === 'live') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </div>
        <span className="text-[10px] font-bold tracking-wider text-emerald-400">LIVE</span>
      </div>
    )
  }
  if (state === 'connecting' || state === 'syncing_snapshot') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
        <span className="text-[10px] font-bold tracking-wider text-amber-400">SYNC</span>
      </div>
    )
  }
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <WifiOff className="w-3 h-3 text-rose-500" />
      <span className="text-[10px] font-bold tracking-wider text-rose-500">OFFLINE</span>
    </div>
  )
}
