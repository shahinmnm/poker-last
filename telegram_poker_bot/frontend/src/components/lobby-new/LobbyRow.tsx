/**
 * Phase 5: LobbyRow Component
 * 
 * Standardized lobby table row with all metadata from backend.
 */

import { useNavigate } from 'react-router-dom'
import type { LobbyEntry } from '../../types/normalized'
import Badge from '../ui/Badge'

interface LobbyRowProps {
  entry: LobbyEntry
  onClick?: (tableId: number) => void
}

export function LobbyRow({ entry, onClick }: LobbyRowProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick(entry.table_id)
    } else {
      navigate(`/table/${entry.table_id}`)
    }
  }

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

  return (
    <div
      className="lobby-row bg-gray-800 hover:bg-gray-700 rounded-lg p-4 cursor-pointer transition-all"
      onClick={handleClick}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Table info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-white">{entry.template_name}</h3>
            <Badge color={tableTypeColor}>
              {entry.table_type}
            </Badge>
            {entry.invite_only && (
              <Badge color="red">Invite Only</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="font-mono">{entry.variant}</span>
            <span className="font-mono">{entry.stakes}</span>
            {entry.uptime !== undefined && (
              <span>Uptime: {formatUptime(entry.uptime)}</span>
            )}
            {entry.expiration && (
              <span>Expires: {formatExpiration(entry.expiration)}</span>
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
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
            Join
          </button>
        </div>
      </div>
    </div>
  )
}

export default LobbyRow
