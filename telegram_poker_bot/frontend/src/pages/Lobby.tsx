import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import SectionHeader from '../components/ui/SectionHeader'
import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, buildApiUrl, resolveApiUrl, type ApiFetchOptions } from '../utils/apiClient'

const REFRESH_INTERVAL_MS = 5000

type LobbyTablesState = 'loading' | 'ready' | 'empty' | 'error'

interface TableHostInfo {
  user_id: number
  username?: string | null
  display_name?: string | null
}

interface TableViewerState {
  is_seated?: boolean
  seat_position?: number | null
  chips?: number | null
  joined_at?: string | null
  is_creator?: boolean
}

interface TableInfo {
  table_id: number
  mode: string
  status: string
  player_count: number
  max_players: number
  small_blind: number
  big_blind: number
  table_name: string | null
  host?: TableHostInfo | null
  created_at?: string | null
  updated_at?: string | null
  starting_stack?: number
  is_full?: boolean
  is_private?: boolean
  is_public?: boolean
  visibility?: 'public' | 'private'
  viewer?: TableViewerState | null
  creator_user_id?: number | null
}

interface ActiveTable extends TableInfo {
  starting_stack: number
  viewer?: TableViewerState | null
}

function normalizeTablesResponse<T>(data: unknown): T[] {
  if (Array.isArray(data)) {
    return data as T[]
  }

  if (data && typeof data === 'object') {
    const candidate =
      (data as Record<string, unknown>).tables ??
      (data as Record<string, unknown>).items ??
      (data as Record<string, unknown>).data

    if (Array.isArray(candidate)) {
      return candidate as T[]
    }
  }

  return []
}

async function fetchPublicTables(
  initData?: string | null,
  signal?: AbortSignal,
): Promise<TableInfo[]> {
  const options: ApiFetchOptions = {
    query: { scope: 'public' },
    signal,
  }

  if (initData) {
    options.initData = initData
  }

  const finalUrl = resolveApiUrl('/tables', options.query)
  console.debug('GET', finalUrl)
  const payload = await apiFetch<unknown>('/tables', options)
  console.debug('Response for /tables', payload)
  return normalizeTablesResponse<TableInfo>(payload)
}

async function fetchMyTables(
  initData?: string | null,
  signal?: AbortSignal,
): Promise<ActiveTable[]> {
  const options: ApiFetchOptions = {
    signal,
  }

  if (initData) {
    options.initData = initData
  }

  console.debug('GET', buildApiUrl('/users/me/tables'))
  const payload = await apiFetch<unknown>('/users/me/tables', options)
  console.debug('Response for /users/me/tables', payload)
  return normalizeTablesResponse<ActiveTable>(payload)
}

export default function LobbyPage() {
  const { t } = useTranslation()
  const { initData, ready } = useTelegram()
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [myTables, setMyTables] = useState<ActiveTable[]>([])
  const [viewState, setViewState] = useState<LobbyTablesState>('loading')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const activeControllerRef = useRef<AbortController | null>(null)

  const loadTables = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
      if (!ready) {
        return
      }

      activeControllerRef.current?.abort()
      const controller = new AbortController()
      activeControllerRef.current = controller

      if (mode === 'initial') {
        setViewState('loading')
      } else if (mode === 'refresh') {
        setViewState((prev) => (prev === 'error' ? 'loading' : prev))
        setIsRefreshing(true)
      }

      try {
        console.debug('Loading lobby tables...')
        const [publicTables, userTables] = await Promise.all([
          fetchPublicTables(initData, controller.signal),
          initData ? fetchMyTables(initData, controller.signal) : Promise.resolve<ActiveTable[]>([]),
        ])

        if (controller.signal.aborted) {
          return
        }

        setAvailableTables(publicTables)
        setMyTables(userTables)

        const nextState: LobbyTablesState =
          publicTables.length === 0 && userTables.length === 0 ? 'empty' : 'ready'
        setViewState(nextState)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        console.error('Error fetching tables:', error)
        setViewState('error')
      } finally {
        if (!controller.signal.aborted && mode === 'refresh') {
          setIsRefreshing(false)
        }
      }
    },
    [initData, ready],
  )

  useEffect(() => {
    if (!ready) {
      return
    }

    loadTables('initial')
    const interval = window.setInterval(() => {
      loadTables('silent')
    }, REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
      activeControllerRef.current?.abort()
    }
  }, [ready, loadTables])

  const handleRefresh = useCallback(() => {
    loadTables('refresh')
  }, [loadTables])

  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [],
  )

  const resolveStatusLabel = (status: string) => {
    const normalized = status.toLowerCase()
    const statusKeyMap: Record<string, string> = {
      waiting: 'waiting',
      active: 'running',
      running: 'running',
      paused: 'starting',
      starting: 'starting',
    }
    const key = statusKeyMap[normalized] || normalized
    return t(`lobby.status.${key}` as const, {
      defaultValue: status,
    })
  }

  const prioritizedTables = useMemo(() => {
    if (availableTables.length === 0) {
      return availableTables
    }

    return [...availableTables].sort((a, b) => {
      const aSeated = a.viewer?.is_seated ? 1 : 0
      const bSeated = b.viewer?.is_seated ? 1 : 0
      if (aSeated !== bSeated) {
        return bSeated - aSeated
      }

      const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return bUpdated - aUpdated
    })
  }, [availableTables])

  if (viewState === 'loading') {
    return (
      <Card className="flex min-h-[40vh] items-center justify-center text-sm text-[color:var(--text-muted)]">
        {t('common.loading')}
      </Card>
    )
  }

  if (viewState === 'error') {
    return (
      <Card className="space-y-3 text-sm text-red-200">
        <p>{t('lobby.errors.loadFailed')}</p>
        <Button onClick={() => loadTables('refresh')} variant="secondary" disabled={isRefreshing}>
          {t('lobby.actions.retry')}
        </Button>
      </Card>
    )
  }

  if (viewState === 'empty') {
    return (
      <Card className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-[color:var(--text-primary)]">{t('lobby.title')}</h1>
          <p className="text-sm text-[color:var(--text-muted)]">{t('menu.lobby.description')}</p>
        </div>
        <p className="text-sm text-[color:var(--text-muted)]">{t('lobby.empty.public')}</p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/games/create" className="app-button app-button--primary app-button--lg app-button--glow">
            {t('lobby.empty.createPublic')}
          </Link>
          <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? t('common.loading') : t('lobby.actions.refresh')}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)] sm:text-2xl">
          {t('lobby.title')}
        </h1>
        <p className="text-sm text-[color:var(--text-muted)]">{t('menu.lobby.description')}</p>
      </header>

      <Card>
        <SectionHeader
          title={t('lobby.myTables.title')}
          subtitle={t('lobby.myTables.subtitle')}
          action={
            <Button variant="ghost" size="md" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? t('common.loading') : t('lobby.actions.refresh')}
            </Button>
          }
        />
        {myTables.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-[color:var(--surface-border)] px-4 py-5 text-center text-sm text-[color:var(--text-muted)]">
            {t('lobby.myTables.empty')}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {myTables.map((table) => {
              const seatPosition = table.viewer?.seat_position ?? null
              const joinedAtText = table.viewer?.joined_at
                ? formatDate.format(new Date(table.viewer.joined_at))
                : null
              const stackAmount = table.viewer?.chips ?? table.starting_stack
              const statusLabel = resolveStatusLabel(table.status)
              const tableName = table.table_name || `Table #${table.table_id}`
              const isCreator = table.viewer?.is_creator ?? false

              return (
                <Link
                  key={table.table_id}
                  to={`/table/${table.table_id}`}
                  state={{ from: '/lobby' }}
                  className="app-card app-card--overlay block rounded-3xl p-5 transition hover:-translate-y-1"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="block font-semibold text-[color:var(--text-primary)]">{tableName}</span>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-muted)]">
                        <Badge variant="success" size="md">
                          {statusLabel}
                        </Badge>
                        {isCreator && (
                          <Badge variant="info" size="md">
                            {t('lobby.labels.youHost')}
                          </Badge>
                        )}
                        {seatPosition !== null && (
                          <Badge variant="muted" size="md">
                            {t('lobby.labels.seated')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-[color:var(--text-muted)]">
                      <span className="block text-lg font-semibold text-[color:var(--text-primary)]">
                        {table.small_blind}/{table.big_blind}
                      </span>
                      <span>{t('lobby.fields.blinds')}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 text-xs text-[color:var(--text-muted)] sm:grid-cols-4">
                    <div>
                      <span className="block text-[11px] uppercase tracking-[0.2em]">{t('lobby.fields.players')}</span>
                      <span className="mt-1 block text-sm font-semibold text-[color:var(--text-primary)]">
                        {table.player_count} / {table.max_players}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase tracking-[0.2em]">{t('lobby.fields.stack')}</span>
                      <span className="mt-1 block text-sm font-semibold text-[color:var(--text-primary)]">{stackAmount}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="block text-[11px] uppercase tracking-[0.2em]">{t('lobby.fields.joined')}</span>
                      <span className="mt-1 block text-sm font-semibold text-[color:var(--text-primary)]">
                        {joinedAtText || '—'}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </Card>

      <Card id="public-tables">
        <SectionHeader
          title={t('lobby.availableTables.title')}
          subtitle={t('lobby.availableTables.subtitle')}
          action={
            <Button variant="ghost" size="md" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? t('common.loading') : t('lobby.actions.refresh')}
            </Button>
          }
        />
        <div className="mt-4 space-y-3">
          {prioritizedTables.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--surface-border)] px-4 py-5 text-center text-sm text-[color:var(--text-muted)]">
              {t('lobby.availableTables.empty')}
            </p>
          ) : (
            prioritizedTables.map((table) => {
              const createdAtText = table.created_at ? formatDate.format(new Date(table.created_at)) : null
              const isSeated = table.viewer?.is_seated
              const isCreator = table.viewer?.is_creator
              const cardMuted = table.is_full && !isSeated

              return (
                <div
                  key={table.table_id}
                  className={`app-card app-card--overlay flex flex-col gap-4 rounded-3xl p-5 transition ${cardMuted ? 'opacity-70' : ''}`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="block text-base font-semibold text-[color:var(--text-primary)]">
                        {table.table_name || `Table #${table.table_id}`}
                      </span>
                      {table.host?.display_name && (
                        <span className="mt-1 block text-xs text-[color:var(--text-muted)]">
                          {t('lobby.fields.host')}: {table.host.display_name}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success" size="md">
                        {resolveStatusLabel(table.status)}
                      </Badge>
                      {table.visibility && (
                        <Badge variant="muted" size="md">
                          {t(`lobby.labels.visibility.${table.visibility}` as const)}
                        </Badge>
                      )}
                      {isSeated && (
                        <Badge variant="info" size="md">
                          {t('lobby.labels.seated')}
                        </Badge>
                      )}
                      {isCreator && (
                        <Badge variant="info" size="md">
                          {t('lobby.labels.youHost')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs text-[color:var(--text-muted)] sm:grid-cols-4">
                    <div>
                      <span className="block font-semibold text-[color:var(--text-primary)]">
                        {table.player_count} / {table.max_players}
                      </span>
                      <span>{t('lobby.fields.players')}</span>
                    </div>
                    <div>
                      <span className="block font-semibold text-[color:var(--text-primary)]">
                        {table.small_blind}/{table.big_blind}
                      </span>
                      <span>{t('lobby.fields.blinds')}</span>
                    </div>
                    <div>
                      <span className="block font-semibold text-[color:var(--text-primary)]">
                        {table.is_full
                          ? t('lobby.labels.full')
                          : isSeated
                          ? t('lobby.labels.seated')
                          : t('lobby.labels.open')}
                      </span>
                      <span>{t('lobby.labels.seating')}</span>
                    </div>
                    <div>
                      <span className="block font-semibold text-[color:var(--text-primary)]">{createdAtText || '—'}</span>
                      <span>{t('lobby.fields.created')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Link
                      to={`/table/${table.table_id}`}
                      state={{ from: '/lobby' }}
                      className={`app-button app-button--primary app-button--md text-center sm:w-auto ${cardMuted ? 'opacity-60' : ''}`}
                    >
                      {isSeated ? t('lobby.actions.view') : t('lobby.actions.join')}
                    </Link>
                    {isSeated && (
                      <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                        {t('lobby.labels.youAreSeated')}
                      </span>
                    )}
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
