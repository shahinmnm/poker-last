import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, ApiError, resolveWebSocketUrl } from '../utils/apiClient'
import Toast from '../components/Toast'

interface TableState {
  id: number
  status: string
  mode?: string
  created_at?: string
  players?: Array<{
    id: number
    position: number
    chips: number
  }>
  board?: string[]
  pots?: Array<{
    pot_index: number
    amount: number
  }>
  current_player?: number | null
}

export default function TablePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const { initData } = useTelegram()
  const { t } = useTranslation()
  const [tableState, setTableState] = useState<TableState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  })

  const boardCards = tableState?.board && Array.isArray(tableState.board) ? tableState.board : []
  const pots = tableState?.pots && Array.isArray(tableState.pots) ? tableState.pots : []

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true })
    window.setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }))
    }, 2400)
  }, [])

  const fetchTable = useCallback(async () => {
    if (!tableId) {
      return
    }
    try {
      setLoading(true)
      setError(null)
      const data = await apiFetch<TableState>(`/tables/${tableId}`, {
        method: 'GET',
        initData: initData ?? undefined,
      })
      setTableState({
        ...data,
        board: data.board ?? [],
        pots: data.pots ?? [],
      })
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
      setTableState(null)
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

  const handleAction = async (actionType: string, amount?: number) => {
    if (!tableId) {
      return
    }
    try {
      setActionPending(true)
      await apiFetch(`/tables/${tableId}/actions`, {
        method: 'POST',
        initData: initData ?? undefined,
        body: {
          action_type: actionType,
          amount,
        },
      })
      showToast(t('table.toast.actionSuccess'))
      fetchTable()
    } catch (error) {
      console.error('Error submitting action:', error)
      if (error instanceof ApiError && error.status === 401) {
        showToast(t('table.errors.unauthorized'))
      } else {
        showToast(t('table.errors.actionFailed'))
      }
    } finally {
      setActionPending(false)
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

  if (!tableState) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-gray-500 dark:text-gray-300">
        {t('table.notFound')}
      </div>
    )
  }

  const createdAtText = useMemo(() => {
    if (!tableState.created_at) {
      return null
    }
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(tableState.created_at))
    } catch {
      return tableState.created_at
    }
  }, [tableState.created_at])

  return (
    <div className="min-h-screen p-4 pb-28">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-xl font-bold">{t('table.title', { id: tableState.id })}</h1>
          <dl className="grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('table.meta.mode')}
              </dt>
              <dd className="mt-1 capitalize">
                {tableState.mode
                  ? t(`table.modes.${tableState.mode.toLowerCase()}` as const, {
                      defaultValue: tableState.mode,
                    })
                  : t('table.meta.unknown')}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('table.meta.status')}
              </dt>
              <dd className="mt-1 capitalize">
                {t(`table.status.${tableState.status.toLowerCase()}` as const, {
                  defaultValue: tableState.status,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('table.meta.created')}
              </dt>
              <dd className="mt-1">{createdAtText || '—'}</dd>
            </div>
          </dl>
        </header>

        <section className="rounded-xl bg-green-100 p-4 dark:bg-green-900">
          <h2 className="mb-2 font-semibold text-green-900 dark:text-green-100">{t('table.board')}</h2>
          {boardCards.length === 0 ? (
            <p className="text-sm text-green-800/80 dark:text-green-200/80">{t('table.empty.board')}</p>
          ) : (
            <div className="flex gap-2">
              {boardCards.map((card, idx) => (
                <div
                  key={`${card}-${idx}`}
                  className="flex h-16 w-12 items-center justify-center rounded border-2 border-gray-300 bg-white text-lg font-bold dark:border-gray-600 dark:bg-gray-800"
                >
                  {card}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/40">
          <h2 className="mb-2 font-semibold text-yellow-900 dark:text-yellow-100">{t('table.pots')}</h2>
          {pots.length === 0 ? (
            <p className="text-sm text-yellow-900/80 dark:text-yellow-200/80">{t('table.empty.pots')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pots.map((pot) => (
                <li
                  key={pot.pot_index}
                  className="rounded-lg bg-white/70 px-3 py-2 dark:bg-yellow-950/60"
                >
                  <span className="font-medium">
                    {pot.pot_index === 0
                      ? t('table.potMain')
                      : t('table.potSide', { index: pot.pot_index })}
                  </span>{' '}
                  · {t('table.chips', { amount: pot.amount })}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-900/95">
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleAction('fold')}
            disabled={actionPending}
            className="rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('table.actions.fold')}
          </button>
          <button
            type="button"
            onClick={() => handleAction('check')}
            disabled={actionPending}
            className="rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('table.actions.check')}
          </button>
          <button
            type="button"
            onClick={() => handleAction('call')}
            disabled={actionPending}
            className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('table.actions.call')}
          </button>
          <button
            type="button"
            onClick={() => handleAction('bet', 100)}
            disabled={actionPending}
            className="rounded-lg bg-purple-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {t('table.actions.bet')}
          </button>
        </div>
      </div>
      <Toast message={toast.message || ''} visible={toast.visible} />
    </div>
  )
}
