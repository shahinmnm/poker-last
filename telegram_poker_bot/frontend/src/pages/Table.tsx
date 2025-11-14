import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, ApiError, resolveWebSocketUrl } from '../utils/apiClient'
import Toast from '../components/Toast'

interface TablePlayer {
  user_id: number
  username?: string | null
  display_name?: string | null
  position: number
  chips: number
  joined_at?: string | null
  is_host?: boolean
}

interface TableViewerInfo {
  user_id: number | null
  is_creator: boolean
  is_seated: boolean
  seat_position?: number | null
}

interface TablePermissions {
  can_start: boolean
  can_join: boolean
  can_leave?: boolean
}

interface TableHostInfo {
  user_id: number
  username?: string | null
  display_name?: string | null
}

interface TableInviteInfo {
  game_id?: string
  status?: string
  expires_at?: string | null
}

interface TableDetails {
  table_id: number
  table_name?: string | null
  mode?: string
  status: string
  small_blind: number
  big_blind: number
  starting_stack: number
  player_count: number
  max_players: number
  created_at?: string | null
  updated_at?: string | null
  host?: TableHostInfo | null
  players?: TablePlayer[]
  viewer?: TableViewerInfo | null
  permissions?: TablePermissions | null
  invite?: TableInviteInfo | null
  is_private?: boolean
  is_public?: boolean
  visibility?: 'public' | 'private'
  group_title?: string | null
}

const DEFAULT_TOAST = { message: '', visible: false }

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { initData } = useTelegram()
  const { t } = useTranslation()

  const [tableDetails, setTableDetails] = useState<TableDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSeating, setIsSeating] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [toast, setToast] = useState(DEFAULT_TOAST)

  const fromRoute = useMemo(() => {
    const state = location.state as { from?: string } | null
    return typeof state?.from === 'string' ? state.from : null
  }, [location.state])

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  )

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true })
    window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 2400)
  }, [])

  const handleBack = useCallback(() => {
    if (fromRoute) {
      navigate(fromRoute)
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/lobby', { replace: true })
    }
  }, [fromRoute, navigate])

  const fetchTable = useCallback(async () => {
    if (!tableId) {
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<TableDetails>(`/tables/${tableId}`, {
        method: 'GET',
        initData: initData ?? undefined,
      })
      setTableDetails(data)
    } catch (err) {
      console.error('Error fetching table:', err)
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setError(t('table.errors.notFound'))
        } else if (err.status === 401) {
          setError(t('table.errors.unauthorized'))
        } else {
          setError(t('table.errors.loadFailed'))
        }
      } else {
        setError(t('table.errors.loadFailed'))
      }
      setTableDetails(null)
    } finally {
      setLoading(false)
    }
  }, [initData, tableId, t])

  useEffect(() => {
    if (!tableId) {
      return
    }
    fetchTable()
  }, [fetchTable, tableId])

  useEffect(() => {
    if (!tableId) {
      return
    }

    let socket: WebSocket | null = null
    try {
      const wsUrl = resolveWebSocketUrl(`/ws/${tableId}`)
      socket = new WebSocket(wsUrl)
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload?.type === 'action') {
            fetchTable()
          }
        } catch {
          // Ignore malformed messages
        }
      }
    } catch (wsError) {
      console.warn('Unable to establish table WebSocket connection:', wsError)
    }
    return () => socket?.close()
  }, [fetchTable, tableId])

  const handleSeat = async () => {
    if (!tableId) {
      return
    }
    if (!initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    try {
      setIsSeating(true)
      await apiFetch(`/tables/${tableId}/sit`, {
        method: 'POST',
        initData,
      })
      showToast(t('table.toast.seated'))
      await fetchTable()
    } catch (err) {
      console.error('Error taking seat:', err)
      if (err instanceof ApiError) {
        const message =
          (typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : null) || t('table.errors.actionFailed')
        showToast(message)
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    } finally {
      setIsSeating(false)
    }
  }

  const handleLeave = async () => {
    if (!tableId) {
      return
    }
    if (!initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    try {
      setIsLeaving(true)
      await apiFetch(`/tables/${tableId}/leave`, {
        method: 'POST',
        initData,
      })
      showToast(t('table.toast.left'))
      await fetchTable()
    } catch (err) {
      console.error('Error leaving seat:', err)
      if (err instanceof ApiError) {
        const message =
          (typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail?: unknown }).detail)
            : null) || t('table.errors.actionFailed')
        showToast(message)
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    } finally {
      setIsLeaving(false)
    }
  }

  const handleStart = async () => {
    if (!tableId) {
      return
    }
    if (!initData) {
      showToast(t('table.errors.unauthorized'))
      return
    }
    try {
      setIsStarting(true)
      const updated = await apiFetch<TableDetails>(`/tables/${tableId}/start`, {
        method: 'POST',
        initData,
      })
      setTableDetails(updated)
      showToast(t('table.toast.started'))
    } catch (err) {
      console.error('Error starting table:', err)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          showToast(t('table.errors.startNotAllowed'))
        } else {
          const message =
            (typeof err.data === 'object' && err.data && 'detail' in err.data
              ? String((err.data as { detail?: unknown }).detail)
              : null) || t('table.errors.actionFailed')
          showToast(message)
        }
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    } finally {
      setIsStarting(false)
    }
  }

  if (!tableId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        {t('table.notFound')}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        {t('table.loading')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center text-sm text-gray-500 dark:text-gray-300">
        <p>{error}</p>
        <button
          type="button"
          onClick={fetchTable}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          {t('table.actions.retry')}
        </button>
      </div>
    )
  }

  if (!tableDetails) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        {t('table.notFound')}
      </div>
    )
  }

  const createdAtText = tableDetails.created_at
    ? dateFormatter.format(new Date(tableDetails.created_at))
    : null
  const inviteExpiresText = tableDetails.invite?.expires_at
    ? dateFormatter.format(new Date(tableDetails.invite.expires_at))
    : null
  const viewerIsCreator = tableDetails.viewer?.is_creator ?? false
  const viewerIsSeated = tableDetails.viewer?.is_seated ?? false
  const canStart = tableDetails.permissions?.can_start ?? false
  const canJoin = tableDetails.permissions?.can_join ?? false
  const canLeave = tableDetails.permissions?.can_leave ?? false
  const missingPlayers = Math.max(0, 2 - tableDetails.player_count)
  const players = (tableDetails.players || []).slice().sort((a, b) => a.position - b.position)
  const tableName = tableDetails.table_name || `Table #${tableDetails.table_id}`
  const hostName = tableDetails.host?.display_name || tableDetails.host?.username || null
  const statusLabel = t(`table.status.${tableDetails.status.toLowerCase()}` as const, {
    defaultValue: tableDetails.status,
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 pb-28 dark:from-gray-950 dark:to-gray-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="rounded-3xl bg-white/80 p-5 shadow-sm backdrop-blur dark:bg-gray-900/80">
          <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-950/60 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-offset-gray-900"
            >
              <span aria-hidden="true">←</span>
              {t('table.actions.back')}
            </button>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 items-center rounded-full bg-emerald-100 px-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
                {statusLabel}
              </span>
              {tableDetails.visibility && (
                <span className="inline-flex h-7 items-center rounded-full bg-slate-200 px-3 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-gray-700 dark:text-gray-200">
                  {t(`table.visibility.${tableDetails.visibility}` as const, {
                    defaultValue: tableDetails.visibility,
                  })}
                </span>
              )}
            </div>
          </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-500 dark:text-blue-300">
                {t('table.headerLabel')}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">{tableName}</h1>
              {tableDetails.group_title && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('table.groupTag', { value: tableDetails.group_title })}
                </p>
              )}
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('table.meta.host')}
              </dt>
              <dd className="mt-1 text-base font-medium text-gray-800 dark:text-gray-100">
                {hostName || t('table.meta.unknown')}
                {tableDetails.mode && (
                  <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
                    {t(`table.modes.${tableDetails.mode.toLowerCase()}` as const, {
                      defaultValue: tableDetails.mode,
                    })}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('table.meta.created')}
              </dt>
              <dd className="mt-1">{createdAtText || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('table.meta.stakes')}
              </dt>
              <dd className="mt-1 font-medium">
                {tableDetails.small_blind}/{tableDetails.big_blind} • {t('table.stacks', { amount: tableDetails.starting_stack })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('table.meta.players')}
              </dt>
              <dd className="mt-1 font-medium">
                {tableDetails.player_count} / {tableDetails.max_players}
              </dd>
            </div>
          </dl>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('table.players.title')}
            </h2>
            <button
              type="button"
              className="text-sm font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-300"
              onClick={fetchTable}
            >
              {t('table.actions.refresh')}
            </button>
          </div>
          {players.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-100/80 px-3 py-4 text-sm text-slate-600 dark:bg-gray-800/60 dark:text-gray-300">
              {t('table.players.empty')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {players.map((player) => (
                <li
                  key={`${player.user_id}-${player.position}`}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-white/80 px-4 py-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-950/50"
                >
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {t('table.players.seat', { index: player.position + 1 })}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {player.display_name || player.username || t('table.meta.unknown')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {t('table.chips', { amount: player.chips })}
                    </p>
                    {player.is_host && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        {t('table.players.hostTag')}
                      </span>
                    )}
                    {tableDetails.viewer?.user_id === player.user_id && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        {t('table.players.youTag')}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/80">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {viewerIsCreator ? t('table.actions.titleHost') : t('table.actions.titleGuest')}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {viewerIsSeated ? (
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={!canLeave || isLeaving}
                  className={`w-full rounded-2xl px-4 py-3 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    !canLeave || isLeaving
                      ? 'cursor-not-allowed bg-rose-200 text-rose-700 opacity-70 dark:bg-rose-900/40 dark:text-rose-200 dark:focus:ring-offset-gray-900'
                      : 'bg-rose-500 text-white shadow-lg hover:bg-rose-600 focus:ring-rose-400 dark:focus:ring-offset-gray-900'
                  }`}
                >
                  {isLeaving ? t('table.actions.leaving') : t('table.actions.leave')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSeat}
                  disabled={!canJoin || isSeating}
                  className={`w-full rounded-2xl px-4 py-3 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    !canJoin || isSeating
                      ? 'cursor-not-allowed bg-blue-200 text-blue-800 opacity-70 dark:bg-blue-900/40 dark:text-blue-200 dark:focus:ring-offset-gray-900'
                      : 'bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:ring-blue-400 dark:focus:ring-offset-gray-900'
                  }`}
                >
                  {isSeating ? t('table.actions.joining') : t('table.actions.takeSeat')}
                </button>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {viewerIsSeated
                  ? viewerIsCreator
                    ? canStart
                      ? t('table.messages.readyToStart')
                      : t('table.messages.waitForPlayers', { count: missingPlayers })
                    : t('table.messages.waitingForHost')
                  : canJoin
                  ? t('table.messages.joinPrompt')
                  : t('table.messages.tableFull')}
              </p>
            </div>

            {viewerIsCreator && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={!canStart || isStarting}
                  className={`w-full rounded-2xl px-4 py-3 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    !canStart || isStarting
                      ? 'cursor-not-allowed bg-emerald-200 text-emerald-700 opacity-70 dark:bg-emerald-900/40 dark:text-emerald-200 dark:focus:ring-offset-gray-900'
                      : 'bg-emerald-500 text-white shadow-lg hover:bg-emerald-600 focus:ring-emerald-400 dark:focus:ring-offset-gray-900'
                  }`}
                >
                  {isStarting ? t('table.actions.starting') : t('table.actions.start')}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {canStart
                    ? t('table.messages.readyToStart')
                    : t('table.messages.waitForPlayers', { count: missingPlayers })}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={fetchTable}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('table.actions.refresh')}
            </button>
          </div>
        </section>

        {inviteExpiresText && (
          <section className="rounded-3xl border border-indigo-200 bg-indigo-50/80 p-5 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/40">
            <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
              {t('table.invite.title')}
            </h3>
            <p className="mt-2 text-xs text-indigo-800 dark:text-indigo-200/80">
              {t('table.invite.expires', { value: inviteExpiresText })}
            </p>
            {tableDetails.invite?.status && (
              <p className="mt-1 text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                {t(`table.invite.status.${tableDetails.invite.status.toLowerCase()}` as const, {
                  defaultValue: tableDetails.invite.status,
                })}
              </p>
            )}
          </section>
        )}
      </div>

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  )
}
