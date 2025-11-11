import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

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
        <header>
          <h1 className="text-2xl font-semibold">{t('joinGame.title')}</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('joinGame.description')}</p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800"
        >
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="invite-code">
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
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase tracking-widest dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              {t('joinGame.form.joinButton')}
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
            >
              {t('joinGame.form.scanButton')}
            </button>
          </div>
        </form>

        <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('joinGame.recent.title')}</h2>
            {recentInvites.length > 0 && (
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {t('joinGame.recent.clear')}
              </button>
            )}
          </div>
          <div className="mt-3 space-y-3">
            {recentInvites.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('joinGame.recent.empty')}</p>
            ) : (
              recentInvites.map((invite) => {
                const statusKey = invite.status ? STATUS_LABEL_KEYS[invite.status.toLowerCase()] : undefined
                const statusLabel = statusKey ? t(statusKey) : null
                const formattedDate = dateFormatter.format(new Date(invite.lastUpdated))

                return (
                  <div
                    key={`${invite.gameId}-${invite.lastUpdated}`}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold tracking-widest">{invite.gameId}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {invite.groupTitle || t('joinGame.recent.unknownGroup')}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t('joinGame.recent.updated', { value: formattedDate })}
                      </p>
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                      {statusLabel && (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600 dark:bg-gray-700 dark:text-gray-200">
                          {statusLabel}
                        </span>
                      )}
                      <button
                        type="button"
                        className="rounded-lg border border-blue-500 px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-950/40"
                        onClick={() =>
                          openInvite(invite.gameId, {
                            groupTitle: invite.groupTitle,
                            status: invite.status,
                          })
                        }
                      >
                        {t('common.actions.join')}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    )
}
