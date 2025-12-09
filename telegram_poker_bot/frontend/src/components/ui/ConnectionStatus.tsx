/**
 * Phase 5: Enhanced ConnectionStatus Component
 * 
 * Visualizes WebSocket connection state with glassmorphism design.
 * Supports Phase 5 ConnectionState types.
 */

import { useMemo } from 'react'
import { Wifi, Loader2, WifiOff } from 'lucide-react'
import type { ConnectionState } from '../../types/normalized'
import type { WebSocketStatus } from '../../legacy/hooks/useTableWebSocket'

interface ConnectionStatusProps {
  connectionState?: ConnectionState
  status?: WebSocketStatus // Legacy support
  className?: string
}

/**
 * Visual indicator for WebSocket connection status.
 * Glassmorphism pill shape with icon and status text.
 */
export default function ConnectionStatus({ connectionState, status, className = '' }: ConnectionStatusProps) {
  const { icon: Icon, text, iconColor, bgColor } = useMemo(() => {
    // Use new ConnectionState if provided, otherwise fall back to legacy status
    const state = connectionState || (status === 'connected' ? 'live' : status === 'connecting' ? 'connecting' : 'disconnected')
    
    switch (state) {
      case 'live':
        return { 
          icon: Wifi, 
          text: 'LIVE', 
          iconColor: 'text-emerald-400',
          bgColor: 'bg-emerald-500/20'
        }
      case 'connecting':
      case 'syncing_snapshot':
        return { 
          icon: Loader2, 
          text: 'SYNCING', 
          iconColor: 'text-amber-400',
          bgColor: 'bg-amber-500/20'
        }
      case 'disconnected':
      case 'version_mismatch':
        return { 
          icon: WifiOff, 
          text: 'OFFLINE', 
          iconColor: 'text-rose-500',
          bgColor: 'bg-rose-500/20'
        }
      default:
        return { 
          icon: WifiOff, 
          text: 'OFFLINE', 
          iconColor: 'text-gray-500',
          bgColor: 'bg-gray-500/20'
        }
    }
  }, [connectionState, status])

  const isAnimating = connectionState === 'connecting' || connectionState === 'syncing_snapshot'

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full ${bgColor} ${className}`}>
      <Icon 
        size={16} 
        className={`${iconColor} ${isAnimating ? 'animate-spin' : ''}`}
      />
      <span className={`text-xs font-bold ${iconColor}`}>
        {text}
      </span>
    </div>
  )
}
