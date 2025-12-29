/**
 * Phase 5: LobbyRow Component
 * 
 * Standardized lobby table row with all metadata from backend.
 * Mobile-first design with 44px minimum tap targets.
 * Includes hot table pulse animation when player count changes.
 */

import { useNavigate } from 'react-router-dom'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      if (rowRef.current) {
        rowRef.current.classList.add('lobby-row-flash')
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          rowRef.current?.classList.remove('lobby-row-flash')
          timeoutRef.current = null
        }, 600)
      }
    }

    prevPlayerCountRef.current = entry.player_count
    prevWaitlistCountRef.current = entry.waitlist_count || 0

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

  const handleJoin = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()

      if (!initData) {
        console.error('[LobbyRow] No initData available')
        return
      }

      if (entry.invite_only) {
        alert(t('lobby.inviteOnly', 'This table is invite only'))
        return
      }

      try {
        setIsJoining(true)
        await apiFetch(`/tables/${entry.table_id}/join`, {
          method: 'POST',
          initData,
        })
        navigate(`/table/${entry.table_id}`)
      } catch (error) {
        console.error('[LobbyRow] Failed to join table:', error)
        alert(t('lobby.joinFailed', 'Failed to join table'))
      } finally {
        setIsJoining(false)
      }
    },
    [entry.table_id, entry.invite_only, initData, navigate, t],
  )

  const handleJoinWaitlist = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()

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
        alert(t('lobby.joinedWaitlist', 'Joined waitlist!'))
      } catch (error) {
        console.error('[LobbyRow] Failed to join waitlist:', error)
        alert(t('lobby.waitlistFailed', 'Failed to join waitlist'))
      } finally {
        setIsJoining(false)
      }
    },
    [entry.table_id, initData, t],
  )

  const formatUptime = (seconds?: number) => {
    if (!seconds) return t('lobby.uptime.justStarted', 'Just started')
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h`
  }

  const formatExpiration = (epochMs: number | null) => {
    if (!epochMs) return null
    const now = Date.now()
    const remaining = epochMs - now
    if (remaining < 0) return t('lobby.expired', 'Expired')
    if (remaining < 60000) return '< 1m'
    if (remaining < 3600000) return `${Math.floor(remaining / 60000)}m`
    return `${Math.floor(remaining / 3600000)}h`
  }

  // Map table type to Badge variant
  const tableTypeVariant: Record<string, 'success' | 'warning' | 'info' | 'muted'> = {
    public: 'success',
    private: 'warning',
    persistent: 'info',
    sng: 'info',
  }

  const isFull = entry.player_count >= entry.max_players
  const showWaitlist = isFull && entry.waitlist_count !== undefined

  return (
    <div
      ref={rowRef}
      className="min-h-[72px] cursor-pointer rounded-2xl p-4 transition-all active:scale-[0.99]"
      onClick={handleClick}
      style={{
        background: 'var(--glass-bg)',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--glass-shadow)',
      }}
    >
      {/* Main row content - stacked on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Left: Table info */}
        <div className="flex-1 min-w-0">
          {/* Top line: variant badge + name */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <GameVariantBadge variant={entry.variant} size="sm" />
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--color-text)' }}
            >
              {entry.template_name}
            </h3>
            <Badge variant={tableTypeVariant[entry.table_type] || 'muted'} size="sm">
              {entry.table_type}
            </Badge>
            {entry.invite_only && (
              <Badge variant="warning" size="sm">
                {t('lobby.inviteOnlyBadge', 'Invite Only')}
              </Badge>
            )}
          </div>

          {/* Stakes and meta info */}
          <div
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span className="font-mono font-semibold" style={{ color: 'var(--color-accent)' }}>
              {entry.stakes}
            </span>
            {entry.currency && (
              <>
                <span className="opacity-50">•</span>
                <span>{entry.currency}</span>
              </>
            )}
            {entry.buy_in_min !== undefined && entry.buy_in_max !== undefined && (
              <>
                <span className="opacity-50">•</span>
                <span>
                  {t('lobby.buyIn', 'Buy-in')}: {entry.buy_in_min}-{entry.buy_in_max}
                </span>
              </>
            )}
            {entry.rake !== undefined && entry.rake > 0 && (
              <>
                <span className="opacity-50">•</span>
                <span>
                  {t('lobby.rake', 'Rake')}: {entry.rake}%
                </span>
              </>
            )}
            {entry.turn_timer !== undefined && (
              <>
                <span className="opacity-50">•</span>
                <span>⏱️ {entry.turn_timer}s</span>
              </>
            )}
            {entry.uptime !== undefined && (
              <>
                <span className="opacity-50">•</span>
                <span>{formatUptime(entry.uptime)}</span>
              </>
            )}
            {entry.expiration && (
              <>
                <span className="opacity-50">•</span>
                <span>
                  {t('lobby.expires', 'Expires')}: {formatExpiration(entry.expiration)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Player count + Action */}
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Player count indicator */}
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{
              background: 'var(--glass-bg-elevated)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
                {entry.player_count}/{entry.max_players}
              </span>
              <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                {t('lobby.players', 'Players')}
              </span>
            </div>
            {entry.waitlist_count !== undefined && entry.waitlist_count > 0 && (
              <span
                className="text-[10px] font-semibold rounded-full px-1.5 py-0.5"
                style={{
                  background: 'var(--color-warning-bg)',
                  color: 'var(--color-warning-text)',
                }}
              >
                +{entry.waitlist_count}
              </span>
            )}
          </div>

          {/* Action button - 44px min height for touch */}
          {entry.invite_only ? (
            <div
              className="min-h-[44px] min-w-[80px] flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {t('lobby.inviteOnlyShort', 'Invite')}
            </div>
          ) : showWaitlist ? (
            <button
              onClick={handleJoinWaitlist}
              disabled={isJoining}
              className="min-h-[44px] min-w-[80px] rounded-xl px-4 py-2 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'var(--color-warning-bg)',
                border: '1px solid rgba(249, 115, 22, 0.3)',
                color: 'var(--color-warning-text)',
              }}
            >
              {isJoining ? t('lobby.joining', 'Joining...') : t('lobby.waitlist', 'Waitlist')}
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={isJoining}
              className="min-h-[44px] min-w-[80px] rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))',
                boxShadow: 'var(--shadow-button)',
              }}
            >
              {isJoining ? t('lobby.joining', 'Joining...') : t('lobby.join', 'Join')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default LobbyRow
