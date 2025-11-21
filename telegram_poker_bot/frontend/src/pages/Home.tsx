import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUsers,
  faUserGroup,
  faUsersRectangle,
  faQrcode,
  faArrowRight,
  faTrophy,
  faChartLine,
  faCoins,
} from '@fortawesome/free-solid-svg-icons'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch } from '../utils/apiClient'
import Card from '../components/ui/Card'

interface ActiveTable {
  table_id: number
  table_name?: string | null
  small_blind: number
  big_blind: number
  player_count: number
  max_players: number
  status: string
  updated_at?: string
  expires_at?: string
}

interface TableInfo {
  table_id: number
  table_name?: string | null
  small_blind: number
  big_blind: number
  player_count: number
  max_players: number
  status: string
  visibility?: string
}

interface UserStats {
  hands_played: number
  win_rate: number
  total_profit: number
}

export default function HomePage() {
  const { ready, initData } = useTelegram()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTable, setActiveTable] = useState<ActiveTable | null>(null)
  const [publicTables, setPublicTables] = useState<TableInfo[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    if (!ready || !initData) return

    Promise.all([
      apiFetch<{ tables: ActiveTable[] }>('/users/me/tables', { initData })
        .then((data) => {
          const tables = data.tables || []
          const active = tables.find((t) =>
            ['active', 'waiting', 'paused'].includes(t.status?.toLowerCase())
          )
          setActiveTable(active || null)
        })
        .catch(() => setActiveTable(null)),
      
      apiFetch<TableInfo[]>('/tables', { initData, query: { scope: 'public' } })
        .then((data) => {
          const tables = Array.isArray(data) ? data : (data as any).tables || []
          setPublicTables(tables.slice(0, 3))
        })
        .catch(() => setPublicTables([])),
      
      apiFetch<UserStats>('/users/me/stats', { initData })
        .then((data) => setStats(data))
        .catch(() => setStats(null)),
    ])
  }, [ready, initData])

  const handleJoinInvite = () => {
    if (inviteCode.trim()) {
      navigate(`/games/join?code=${inviteCode.trim()}`)
    }
  }

  if (!ready) {
    return (
      <Card className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('common.loading')}
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {activeTable && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: 'var(--glass-bg-elevated)',
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('home.continueGame.title', 'Continue your game')}
            </h2>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success-text)' }}>
              {t('home.continueGame.active', 'Active')}
            </span>
          </div>
          <div className="mb-4 space-y-2">
            <p className="font-medium" style={{ color: 'var(--color-text)' }}>
              {activeTable.table_name || `Table #${activeTable.table_id}`}
            </p>
            <div className="flex gap-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <span>{activeTable.small_blind}/{activeTable.big_blind}</span>
              <span>•</span>
              <span>{activeTable.player_count}/{activeTable.max_players} {t('home.continueGame.players', 'players')}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/table/${activeTable.table_id}`)}
              className="flex-1 rounded-xl px-4 py-3 font-semibold text-white transition-transform active:scale-98"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))',
                boxShadow: 'var(--shadow-button)',
              }}
            >
              {t('home.continueGame.rejoin', 'Rejoin table')}
            </button>
            <button
              className="rounded-xl px-4 py-3 text-sm font-medium transition-transform active:scale-98"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {t('home.continueGame.leave', 'Leave')}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {[
          {
            key: 'public',
            icon: faUsers,
            label: t('home.actions.public.label', 'Play Public Tables'),
            subtitle: t('home.actions.public.subtitle', 'Join live tables'),
            path: '/lobby',
          },
          {
            key: 'friends',
            icon: faUserGroup,
            label: t('home.actions.friends.label', 'Play with Friends'),
            subtitle: t('home.actions.friends.subtitle', 'Create a private table'),
            path: '/games/create?mode=private',
          },
          {
            key: 'group',
            icon: faUsersRectangle,
            label: t('home.actions.group.label', 'Start Group Game'),
            subtitle: t('home.actions.group.subtitle', 'Launch inside a Telegram group'),
            path: '/group/invite',
          },
        ].map((action) => (
          <button
            key={action.key}
            onClick={() => navigate(action.path)}
            className="flex items-center gap-4 rounded-2xl p-4 text-left transition-transform active:scale-98"
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur))',
              WebkitBackdropFilter: 'blur(var(--glass-blur))',
              border: '1px solid var(--glass-border)',
              boxShadow: 'var(--glass-shadow)',
            }}
          >
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl"
              style={{
                background: 'var(--glass-bg-elevated)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <FontAwesomeIcon icon={action.icon} className="text-xl" style={{ color: 'var(--color-text)' }} />
            </div>
            <div className="flex-1">
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {action.label}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {action.subtitle}
              </p>
            </div>
            <FontAwesomeIcon icon={faArrowRight} style={{ color: 'var(--color-text-muted)' }} />
          </button>
        ))}
      </div>

      <button
        onClick={() => navigate('/games/join')}
        className="flex w-full items-center justify-center gap-3 rounded-2xl px-4 py-4 transition-transform active:scale-98"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          WebkitBackdropFilter: 'blur(var(--glass-blur))',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <FontAwesomeIcon icon={faQrcode} className="text-2xl" style={{ color: 'var(--color-text)' }} />
        <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
          {t('home.qrJoin.label', 'Join via QR')}
        </span>
      </button>

      {publicTables.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              {t('home.publicTables.title', 'Public Tables')}
            </h2>
            <button
              onClick={() => navigate('/lobby')}
              className="text-sm font-medium"
              style={{ color: 'var(--color-accent)' }}
            >
              {t('home.publicTables.viewAll', 'View all')}
            </button>
          </div>
          <div className="space-y-2">
            {publicTables.map((table) => (
              <button
                key={table.table_id}
                onClick={() => navigate(`/table/${table.table_id}`)}
                className="flex w-full items-center justify-between rounded-xl p-3 text-left transition-transform active:scale-98"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <div className="flex-1">
                  <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                    {table.table_name || `Table #${table.table_id}`}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {table.small_blind}/{table.big_blind} • {table.player_count}/{table.max_players}
                  </p>
                </div>
                <span className="rounded-lg px-3 py-1 text-xs font-semibold" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}>
                  {t('home.publicTables.join', 'Join')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: faTrophy, label: t('home.stats.games', 'Games'), value: stats.hands_played },
            { icon: faChartLine, label: t('home.stats.winRate', 'Win Rate'), value: `${stats.win_rate.toFixed(1)}%` },
            { icon: faCoins, label: t('home.stats.profit', 'Profit'), value: stats.total_profit >= 0 ? `+${stats.total_profit}` : stats.total_profit },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="rounded-xl p-3 text-center"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <FontAwesomeIcon icon={stat.icon} className="mb-2" style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <div
        className="rounded-2xl p-4"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          {t('home.inviteCode.label', 'Enter invite code')}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder={t('home.inviteCode.placeholder', 'Enter code')}
            className="flex-1 rounded-xl px-4 py-3 text-sm uppercase tracking-wider"
            style={{
              background: 'var(--glass-bg-elevated)',
              border: '1px solid var(--glass-border)',
              color: 'var(--color-text)',
            }}
          />
          <button
            onClick={handleJoinInvite}
            className="rounded-xl px-6 py-3 font-semibold"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-start), var(--color-accent-end))',
              color: '#fff',
            }}
          >
            {t('home.inviteCode.join', 'Join')}
          </button>
        </div>
      </div>
    </div>
  )
}
