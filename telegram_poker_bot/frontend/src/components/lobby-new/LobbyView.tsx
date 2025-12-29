/**
 * Phase 5: LobbyView Component
 * 
 * Lobby UI with WebSocket sync and periodic REST refresh.
 * Mobile-first design matching app's glassmorphism theme.
 */

import { useTranslation } from 'react-i18next'
import { useLobbySync } from '../../hooks/useLobbySync'
import LobbyRow from './LobbyRow'

interface LobbyViewProps {
  onTableClick?: (tableId: number) => void
}

/** Refresh interval for lobby data in milliseconds */
const REFRESH_INTERVAL_MS = 25000

export function LobbyView({ onTableClick }: LobbyViewProps) {
  const { t } = useTranslation()
  const { tables, connectionState, refresh } = useLobbySync({
    enabled: true,
    refreshInterval: REFRESH_INTERVAL_MS,
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="flex items-center justify-between rounded-2xl p-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            {t('lobby.title', 'Poker Tables')}
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {t('lobby.subtitle', 'Join a table and start playing')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === 'live'
                  ? 'bg-emerald-400'
                  : connectionState === 'connecting' || connectionState === 'syncing_snapshot'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-rose-400'
              }`}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {connectionState === 'live'
                ? t('lobby.status.live', 'Live')
                : connectionState === 'connecting' || connectionState === 'syncing_snapshot'
                  ? t('lobby.status.connecting', 'Connecting')
                  : t('lobby.status.offline', 'Offline')}
            </span>
          </div>
          <button
            onClick={refresh}
            className="min-h-[44px] min-w-[44px] rounded-xl px-3 py-2 text-sm font-medium transition-all active:scale-95"
            style={{
              background: 'var(--glass-bg-elevated)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text)',
            }}
          >
            {t('lobby.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {/* Table list */}
      <div className="space-y-3">
        {tables.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-2xl py-12"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <p className="text-base font-medium" style={{ color: 'var(--color-text)' }}>
              {t('lobby.empty.title', 'No tables available')}
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {t('lobby.empty.subtitle', 'Check back later or create a new table')}
            </p>
          </div>
        ) : (
          tables.map((entry) => (
            <LobbyRow key={entry.table_id} entry={entry} onClick={onTableClick} />
          ))
        )}
      </div>
    </div>
  )
}

export default LobbyView
