/**
 * Phase 5: LobbyRow Component
 * 
 * Standardized lobby table row with all metadata from backend.
 * Includes hot table pulse animation when player count changes.
 */

import { useNavigate } from 'react-router-dom'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTelegram } from '../../hooks/useTelegram'
import { apiFetch } from '@/utils/apiClient'
import type { LobbyEntry } from '../../types/normalized'
import Badge from '../ui/Badge'
import GameVariantBadge from '../ui/GameVariantBadge'

interface LobbyRowProps {
  entry: LobbyEntry
  onClick?: (tableId: number) => void
}

export function LobbyRow({ entry, onClick }: LobbyRowProps) {
  const navigate = useNavigate()
  const { initData } = useTelegram()
  const [isJoining, setIsJoining] = useState(false)
  
  // Track previous values for detecting changes
  const prevPlayerCountRef = useRef(entry.player_count)
  const prevWaitlistCountRef = useRef(entry.waitlist_count || 0)
  const rowRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Detect changes in player count or waitlist count
  useEffect(() => {
    const playerCountIncreased = entry.player_count > prevPlayerCountRef.current
    const waitlistCountIncreased = (entry.waitlist_count || 0) > prevWaitlistCountRef.current
    
    if (playerCountIncreased || waitlistCountIncreased) {
      // Trigger flash animation
      if (rowRef.current) {
        rowRef.current.classList.add('lobby-row-flash')
        
        // Clear existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        // Remove class after animation completes
        timeoutRef.current = setTimeout(() => {
          rowRef.current?.classList.remove('lobby-row-flash')
          timeoutRef.current = null
        }, 600)
      }
    }
    
    // Update refs
    prevPlayerCountRef.current = entry.player_count
    prevWaitlistCountRef.current = entry.waitlist_count || 0
    
    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [entry.player_count, entry.waitlist_count])

  const handleClick = () => {
    if (onClick) {
      onClick(entry.table_id)
    } else {
      navigate(`/table/${entry.table_id}`)
    }
  }

  const handleJoin = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    
    if (!initData) {
      console.error('[LobbyRow] No initData available')
      return
    }

    // If private and invite-only, show message
    if (entry.invite_only) {
      alert('This table is invite only')
      return
    }

    try {
      setIsJoining(true)
      
      await apiFetch(`/tables/${entry.table_id}/join`, {
        method: 'POST',
        initData,
      })

      // Navigate to table on success
      navigate(`/table/${entry.table_id}`)
    } catch (error) {
      console.error('[LobbyRow] Failed to join table:', error)
      alert('Failed to join table')
    } finally {
      setIsJoining(false)
    }
  }, [entry.table_id, entry.invite_only, initData, navigate])

  const handleJoinWaitlist = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    
    if (!initData) {
      console.error('[LobbyRow] No initData available')
      return
    }

    try {
      setIsJoining(true)
      
      await apiFetch(`/tables/${entry.table_id}/waitlist/join`, {
        method: 'POST',
        initData,
      })

      alert('Joined waitlist!')
    } catch (error) {
      console.error('[LobbyRow] Failed to join waitlist:', error)
      alert('Failed to join waitlist')
    } finally {
      setIsJoining(false)
    }
  }, [entry.table_id, initData])

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'Just started'
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h`
  }

  const formatExpiration = (epochMs: number | null) => {
    if (!epochMs) return null
    const now = Date.now()
    const remaining = epochMs - now
    if (remaining < 0) return 'Expired'
    if (remaining < 60000) return '< 1m'
    if (remaining < 3600000) return `${Math.floor(remaining / 60000)}m`
    return `${Math.floor(remaining / 3600000)}h`
  }

  const tableTypeColor = {
    public: 'green',
    private: 'yellow',
    persistent: 'blue',
    sng: 'purple',
  }[entry.table_type] || 'gray'

  // Determine button to show
  const isFull = entry.player_count >= entry.max_players
  const showWaitlist = isFull && entry.waitlist_count !== undefined

  return (
    <div
      ref={rowRef}
      className="lobby-row bg-gray-800 hover:bg-gray-700 rounded-lg p-4 cursor-pointer transition-all"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Table info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <GameVariantBadge variant={entry.variant} size="sm" />
            <h3 className="font-semibold text-white text-sm">
              {entry.template_name}
            </h3>
            <Badge color={tableTypeColor}>
              {entry.table_type}
            </Badge>
            {entry.invite_only && (
              <Badge color="red">Invite Only</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="font-mono">{entry.stakes}</span>
            {entry.currency && (
              <>
                <span>•</span>
                <span>{entry.currency}</span>
              </>
            )}
            {entry.buy_in_min !== undefined && entry.buy_in_max !== undefined && (
              <>
                <span>•</span>
                <span>Buy-in: {entry.buy_in_min}-{entry.buy_in_max}</span>
              </>
            )}
            {entry.rake !== undefined && entry.rake > 0 && (
              <>
                <span>•</span>
                <span>Rake: {entry.rake}%</span>
              </>
            )}
            {entry.turn_timer !== undefined && (
              <>
                <span>•</span>
                <span>Timer: {entry.turn_timer}s</span>
              </>
            )}
            {entry.uptime !== undefined && (
              <>
                <span>•</span>
                <span>Uptime: {formatUptime(entry.uptime)}</span>
              </>
            )}
            {entry.expiration && (
              <>
                <span>•</span>
                <span>Expires: {formatExpiration(entry.expiration)}</span>
              </>
            )}
          </div>
        </div>

        {/* Player count */}
        <div className="flex flex-col items-center gap-1">
          <div className="text-2xl font-bold text-white">
            {entry.player_count}/{entry.max_players}
          </div>
          <div className="text-xs text-gray-500">Players</div>
          {entry.waitlist_count !== undefined && entry.waitlist_count > 0 && (
            <div className="text-xs text-yellow-400">
              +{entry.waitlist_count} waiting
            </div>
          )}
        </div>

        {/* Action button */}
        <div>
          {entry.invite_only ? (
            <div className="px-4 py-2 bg-gray-600 text-gray-300 rounded-lg font-semibold text-sm">
              Invite Only
            </div>
          ) : showWaitlist ? (
            <button
              onClick={handleJoinWaitlist}
              disabled={isJoining}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : 'Join Waitlist'}
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={isJoining}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default LobbyRow
