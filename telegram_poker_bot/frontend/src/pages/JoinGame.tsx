import { FormEvent, useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import PageHeader from '../components/ui/PageHeader'
import TableSummary from '../components/tables/TableSummary'
import type { TableStatusTone } from '../components/lobby/types'
import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, ApiError } from '../utils/apiClient'
import {
  clearRecentInvites,
  loadRecentInvites,
  RecentInviteEntry,
  upsertRecentInvite,
} from '../utils/recentInvites'
import { INVITE_CODE_LENGTH, INVITE_CODE_MAX_LENGTH, INVITE_CODE_PATTERN, normalizeInviteCode } from '../utils/invite'

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'joinGame.recent.status.pending',
  ready: 'joinGame.recent.status.ready',
  consumed: 'joinGame.recent.status.consumed',
  expired: 'joinGame.recent.status.expired',
}

interface JoinResponseTable {
  table_id: number
  table_name?: string | null
  small_blind: number
  big_blind: number
  starting_stack: number
  player_count: number
  max_players: number
  status: string
  is_private?: boolean
  is_public?: boolean
  visibility?: 'public' | 'private'
  host?: { display_name?: string | null } | null
  invite_code?: string | null
  expires_at?: string | null
}

interface JoinByInviteResponse {
  table_id: number
  status: string
  message: string
  table?: JoinResponseTable
}

export default function JoinGamePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { initData } = useTelegram()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [joinResult, setJoinResult] = useState<JoinByInviteResponse | null>(null)
  const [recentInvites, setRecentInvites] = useState<RecentInviteEntry[]>([])

  useEffect(() => {
    setRecentInvites(loadRecentInvites())
  }, [])

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }),
    [],
  )

  const resolveStatus = useCallback(
    (status: string): { label: string; tone: TableStatusTone } => {
      const normalized = status.toLowerCase()
      const statusKeyMap: Record<string, string> = {
        waiting: 'waiting',
        active: 'running',
        running: 'running',
        paused: 'waiting',
        starting: 'waiting',
        finished: 'finished',
        completed: 'finished',
        seated: 'running',
      }
      const key = statusKeyMap[normalized] || normalized
      const tone: TableStatusTone = key === 'running' ? 'running' : key === 'finished' ? 'finished' : 'waiting'

      return {
        label: t(`lobby.status.${key}` as const, { defaultValue: status }),
        tone,
      }
    },
    [t],
  )

  const submitInvite = useCallback(
    async (normalized: string) => {
      if (!initData) {
        setError(t('joinGame.form.authRequired'))
        return
      }

      setIsSubmitting(true)
      setError(null)
      setJoinResult(null)

      try {
        const response = await apiFetch<JoinByInviteResponse>('/tables/join-by-invite', {
          method: 'POST',
          initData,
          body: { invite_code: normalized },
        })
        setJoinResult(response)
        const updated = upsertRecentInvite({
          gameId: normalized,
          groupTitle: response.table?.table_name ?? null,
          status: response.status,
        })
        setRecentInvites(updated)
      } catch (err) {
        if (err instanceof ApiError) {
          const detail =
            (typeof err.data === 'object' && err.data && 'detail' in err.data
              ? String((err.data as { detail?: unknown }).detail)
              : null) || t('joinGame.form.joinFailed')
          setError(detail)
        } else {
          setError(t('joinGame.form.joinFailed'))
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [initData, t],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = normalizeInviteCode(code)
    if (!normalized || normalized.length < INVITE_CODE_LENGTH || !INVITE_CODE_PATTERN.test(normalized)) {
      setError(t('joinGame.form.invalidCode', { min: INVITE_CODE_LENGTH }))
      return
    }
    void submitInvite(normalized)
  }

  const handleClearHistory = () => {
    clearRecentInvites()
    setRecentInvites([])
  }

  const handleRecentInvite = (raw: string) => {
    const normalized = normalizeInviteCode(raw)
    if (!normalized) {
      return
    }
    setCode(normalized)
    setError(null)
    setJoinResult(null)
  }

  const activeTable = joinResult?.table
  const statusBadge = activeTable ? resolveStatus(activeTable.status) : null

  return (
    <div className="space-y-6">
      <PageHeader title={t('joinGame.title')} subtitle={t('joinGame.description')} />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-body font-medium text-[color:var(--text-primary)]" htmlFor="invite-code">
              {t('joinGame.form.codeLabel')}
            </label>
            <input
              id="invite-code"
              type="text"
              value={code}
              maxLength={INVITE_CODE_MAX_LENGTH}
              onChange={(event) => {
                setCode(normalizeInviteCode(event.target.value))
                setError(null)
              }}
              placeholder={t('joinGame.form.codePlaceholder') ?? ''}
              className="w-full rounded-2xl border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-body uppercase tracking-widest text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
            />
            {error && <p className="text-caption text-red-400">{error}</p>}
          </div>

          <div className="flex gap-3">
            <Button type="submit" variant="primary" size="lg" block disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('joinGame.form.joinButton')}
            </Button>
            <Button type="button" variant="secondary" size="lg" block>
              {t('joinGame.form.scanButton')}
            </Button>
          </div>
        </form>
      </Card>

      {joinResult && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                {t('joinGame.preview.title')}
              </p>
              <h3 className="text-base font-semibold text-[color:var(--text-primary)]">{joinResult.message}</h3>
            </div>
            <Badge variant="muted" size="md">
              {joinResult.status}
            </Badge>
          </div>

          {activeTable && statusBadge && (
            <TableSummary
              tableName={activeTable.table_name || t('table.meta.unnamed', { defaultValue: 'Private Table' })}
              chipLabel={`${activeTable.small_blind}/${activeTable.big_blind}`}
              statusBadge={statusBadge}
              meta={[
                {
                  icon: '👥',
                  label: t('table.meta.players'),
                  value: `${activeTable.player_count} / ${activeTable.max_players}`,
                },
                {
                  icon: '🎯',
                  label: t('table.meta.stakes'),
                  value: `${activeTable.small_blind}/${activeTable.big_blind}`,
                },
                {
                  icon: '⏳',
                  label: t('table.meta.expires'),
                  value: activeTable.expires_at ? dateFormatter.format(new Date(activeTable.expires_at)) : '—',
                },
              ]}
              badges={[
                activeTable.visibility === 'private'
                  ? { label: t('table.visibility.private'), tone: 'visibility' }
                  : { label: t('table.visibility.public'), tone: 'visibility' },
              ]}
              actionLabel={t('common.actions.view')}
              expiresAt={activeTable.expires_at ?? null}
              href={`/table/${activeTable.table_id}`}
            />
          )}

          {activeTable?.invite_code && (
            <div className="flex items-center justify-between rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] px-3 py-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
                  {t('table.invite.codeLabel')}
                </p>
                <p className="font-mono text-lg font-semibold text-[color:var(--text-primary)]">{activeTable.invite_code}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigator.clipboard.writeText(activeTable.invite_code || '')}
              >
                {t('table.invite.copy', { defaultValue: 'Copy' })}
              </Button>
            </div>
          )}

          {activeTable && (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate(`/table/${activeTable.table_id}`)}
                block
              >
                {t('common.actions.join')}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setJoinResult(null)} block>
                {t('common.actions.reset', { defaultValue: 'Reset' })}
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-section-title text-[color:var(--text-primary)]">{t('joinGame.recent.title')}</h2>
          {recentInvites.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearHistory}>
              {t('joinGame.recent.clear')}
            </Button>
          )}
        </div>
        <div className="mt-3 space-y-3">
          {recentInvites.length === 0 ? (
            <p className="text-body text-[color:var(--text-muted)]">{t('joinGame.recent.empty')}</p>
          ) : (
            recentInvites.map((invite) => {
              const statusKey = invite.status ? STATUS_LABEL_KEYS[invite.status.toLowerCase()] : undefined
              const statusLabel = statusKey ? t(statusKey) : null
              const formattedDate = dateFormatter.format(new Date(invite.lastUpdated))

              return (
                <div
                  key={`${invite.gameId}-${invite.lastUpdated}`}
                  className="flex flex-col gap-3 rounded-xl border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-body font-semibold tracking-widest text-[color:var(--text-primary)]">{invite.gameId}</p>
                    <p className="text-caption text-[color:var(--text-muted)]">
                      {invite.groupTitle || t('joinGame.recent.unknownGroup')}
                    </p>
                    <p className="text-caption text-[color:var(--text-muted)]">
                      {t('joinGame.recent.updated', { value: formattedDate })}
                    </p>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                    {statusLabel && (
                      <Badge variant="muted" size="md">
                        {statusLabel}
                      </Badge>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRecentInvite(invite.gameId)}
                    >
                      {t('common.actions.join')}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}
