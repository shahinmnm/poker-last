/**
 * Phase 5: LobbyView Component
 * 
 * Lobby UI with WebSocket sync and periodic REST refresh.
 */

import { useLobbySync } from '../../hooks/useLobbySync'
import LobbyRow from './LobbyRow'

interface LobbyViewProps {
  onTableClick?: (tableId: number) => void
}

export function LobbyView({ onTableClick }: LobbyViewProps) {
  const { tables, connectionState, refresh } = useLobbySync({
    enabled: true,
    refreshInterval: 25000, // 25s
  })

  return (
    <div className="lobby-view">
      {/* Header */}
      <div className="lobby-header flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Poker Tables</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-400">Status: {connectionState}</div>
          <button
            onClick={refresh}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Table list */}
      <div className="lobby-tables space-y-2">
        {tables.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No tables available</p>
            <p className="text-sm mt-2">Check back later or create a new table</p>
          </div>
        ) : (
          tables.map((entry) => (
            <LobbyRow
              key={entry.table_id}
              entry={entry}
              onClick={onTableClick}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default LobbyView
