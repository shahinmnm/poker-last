import { useMemo } from 'react'
import type { WebSocketStatus } from '../../legacy/hooks/useTableWebSocket'

interface ConnectionStatusProps {
  status: WebSocketStatus
  className?: string
}

/**
 * Visual indicator for WebSocket connection status.
 * Shows a colored dot and status text.
 */
export default function ConnectionStatus({ status, className = '' }: ConnectionStatusProps) {
  const { color, text, pulse } = useMemo(() => {
    switch (status) {
      case 'connected':
        return { color: 'bg-emerald-500', text: 'Connected', pulse: false }
      case 'connecting':
        return { color: 'bg-amber-500', text: 'Connecting...', pulse: true }
      case 'disconnected':
        return { color: 'bg-gray-500', text: 'Disconnected', pulse: false }
      case 'error':
        return { color: 'bg-rose-500', text: 'Error', pulse: false }
      default:
        return { color: 'bg-gray-500', text: 'Unknown', pulse: false }
    }
  }, [status])

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <div className="relative">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        {pulse && (
          <div className={`absolute inset-0 h-2 w-2 rounded-full ${color} animate-ping opacity-75`} />
        )}
      </div>
      <span className="text-[color:var(--text-muted)]">{text}</span>
    </div>
  )
}
