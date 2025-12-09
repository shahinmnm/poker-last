/**
 * Phase 6: Enhanced ConnectionStatus Component
 * 
 * High-fidelity traffic light system for WebSocket connection state.
 * - LIVE: Green Pulse (Emerald-500) + Wifi Icon
 * - SYNCING: Yellow Spinner (Amber-400) + Loader2 Icon (animate-spin)
 * - DISCONNECTED: Red Alert (Rose-600) + WifiOff Icon
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

interface StatusConfig {
  icon: typeof Wifi | typeof Loader2 | typeof WifiOff
  text: string
  iconColor: string
  bgColor: string
  pulseColor?: string
  shouldSpin?: boolean
  shouldPulse?: boolean
}

/**
 * Get status configuration based on connection state
 */
function getStatusConfig(state: ConnectionState | WebSocketStatus): StatusConfig {
  switch (state) {
    case 'live':
    case 'connected':
      return { 
        icon: Wifi, 
        text: 'LIVE', 
        iconColor: 'text-emerald-500',
        bgColor: 'bg-emerald-500/20',
        pulseColor: 'bg-emerald-500',
        shouldPulse: true,
        shouldSpin: false,
      }
    case 'connecting':
    case 'syncing_snapshot':
      return { 
        icon: Loader2, 
        text: 'SYNCING', 
        iconColor: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        shouldPulse: false,
        shouldSpin: true,
      }
    case 'disconnected':
    case 'version_mismatch':
      return { 
        icon: WifiOff, 
        text: 'OFFLINE', 
        iconColor: 'text-rose-600',
        bgColor: 'bg-rose-500/20',
        shouldPulse: false,
        shouldSpin: false,
      }
    default:
      return { 
        icon: WifiOff, 
        text: 'OFFLINE', 
        iconColor: 'text-gray-500',
        bgColor: 'bg-gray-500/20',
        shouldPulse: false,
        shouldSpin: false,
      }
  }
}

/**
 * Visual indicator for WebSocket connection status.
 * Traffic light system with pulsing and spinning animations.
 */
export default function ConnectionStatus({ connectionState, status, className = '' }: ConnectionStatusProps) {
  const { icon: Icon, text, iconColor, bgColor, pulseColor, shouldSpin, shouldPulse } = useMemo(() => {
    // Use new ConnectionState if provided, otherwise fall back to legacy status
    const state = connectionState || (status === 'connected' ? 'live' : status === 'connecting' ? 'connecting' : 'disconnected')
    return getStatusConfig(state)
  }, [connectionState, status])

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full ${bgColor} ${className} relative`}>
      {/* Pulse indicator for LIVE state */}
      {shouldPulse && pulseColor && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
          <span className={`absolute inline-flex h-3 w-3 rounded-full ${pulseColor} opacity-75 animate-ping`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`}></span>
        </div>
      )}
      
      {/* Icon */}
      <Icon 
        size={16} 
        className={`${iconColor} ${shouldSpin ? 'animate-spin' : ''} ${shouldPulse ? 'ml-2' : ''}`}
      />
      
      {/* Status text */}
      <span className={`text-xs font-bold ${iconColor}`}>
        {text}
      </span>
    </div>
  )
}
