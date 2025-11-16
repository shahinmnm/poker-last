import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import PageHeader from '../components/ui/PageHeader'
import {
  clearRecentInvites,
  loadRecentInvites,
  RecentInviteEntry,
  upsertRecentInvite,
} from '../utils/recentInvites'

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'joinGame.recent.status.pending',
  ready: 'joinGame.recent.status.ready',
  consumed: 'joinGame.recent.status.consumed',
  expired: 'joinGame.recent.status.expired',
}

export default function JoinGamePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recentInvites, setRecentInvites] = useState<RecentInviteEntry[]>([])

  useEffect(() => {
    setRecentInvites(loadRecentInvites())
  }, [])

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }),
    [],
  )

  const openInvite = (raw: string, metadata?: { groupTitle?: string | null; status?: string | null }) => {
    const normalized = raw.trim().toUpperCase()
    if (!normalized) {
      return
    }
    setCode(normalized)
    setError(null)
    const updated = upsertRecentInvite({
      gameId: normalized,
      groupTitle: metadata?.groupTitle ?? null,
      status: metadata?.status ?? null,
    })
    setRecentInvites(updated)
    navigate(`/group/join/${encodeURIComponent(normalized)}`)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = code.trim().toUpperCase()
    if (normalized.length < 8 || !/^[A-Z0-9_-]+$/.test(normalized)) {
      setError(t('joinGame.form.invalidCode'))
      return
    }
    openInvite(normalized)
  }

  const handleClearHistory = () => {
    clearRecentInvites()
    setRecentInvites([])
  }

    return (
      <div className="space-y-6">
        <PageHeader
          title={t('joinGame.title')}
          subtitle={t('joinGame.description')}
        />

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-body font-medium text-[color:var(--text-primary)]" htmlFor="invite-code">
                {t('joinGame.form.codeLabel')}
              </label>
              <input
                id="invite-code"
                type="text"
                value={code.toUpperCase()}
                maxLength={48}
                onChange={(event) => {
                  setCode(event.target.value.toUpperCase())
                  setError(null)
                }}
                placeholder={t('joinGame.form.codePlaceholder') ?? ''}
                className="w-full rounded-2xl border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-body uppercase tracking-widest text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              />
              {error && <p className="text-caption text-red-400">{error}</p>}
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
              >
                {t('joinGame.form.joinButton')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                block
              >
                {t('joinGame.form.scanButton')}
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-section-title text-[color:var(--text-primary)]">{t('joinGame.recent.title')}</h2>
            {recentInvites.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
              >
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
                        onClick={() =>
                          openInvite(invite.gameId, {
                            groupTitle: invite.groupTitle,
                            status: invite.status,
                          })
                        }
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
