import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import LobbyEmptyState from '../components/lobby/LobbyEmptyState'
import LobbySection from '../components/lobby/LobbySection'
import TableRow from '../components/lobby/TableRow'
import type { ActiveTable, TableInfo, TableStatusTone } from '../components/lobby/types'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { useTelegram } from '../hooks/useTelegram'
import { apiFetch, buildApiUrl, resolveApiUrl, type ApiFetchOptions } from '../utils/apiClient'

const REFRESH_INTERVAL_MS = 5000

type LobbyTablesState = 'loading' | 'ready' | 'empty' | 'error'

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
      }
      const key = statusKeyMap[normalized] || normalized
      const tone: TableStatusTone = key === 'running' ? 'running' : key === 'finished' ? 'finished' : 'waiting'

      return {
        label: t(`lobby.status.${key}` as const, {
          defaultValue: status,
        }),
        tone,
      }
    },
    [t],
  )

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
      <div className="space-y-6 sm:space-y-7">
        <PageHeader
          title={t('lobby.title')}
          subtitle={t('menu.lobby.description')}
          rightAction={
            <Button variant="ghost" size="md" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? t('common.loading') : t('lobby.actions.refresh')}
            </Button>
          }
        />
        <Card className="space-y-6 text-center">
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">{t('lobby.title')}</h1>
            <p className="text-sm text-[color:var(--text-muted)]">{t('menu.lobby.description')}</p>
          </div>
          <LobbyEmptyState
            title={t('lobby.empty.public')}
            action={
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link to="/games/create" className="app-button app-button--primary app-button--md app-button--glow">
                  {t('lobby.empty.createPublic')}
                </Link>
                <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
                  {isRefreshing ? t('common.loading') : t('lobby.actions.refresh')}
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      <PageHeader
        title={t('lobby.title')}
        subtitle={t('menu.lobby.description')}
        rightAction={
          <Button variant="ghost" size="md" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? t('common.loading') : t('lobby.actions.refresh')}
          </Button>
        }
      />

      <LobbySection
        title={t('lobby.myTables.title')}
        subtitle={t('lobby.myTables.subtitle')}
        action={
          <Button variant="ghost" size="md" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? t('common.loading') : t('lobby.actions.refresh')}
          </Button>
        }
      >
        {myTables.length === 0 ? (
          <LobbyEmptyState title={t('lobby.myTables.empty')} />
        ) : (
          myTables.map((table) => {
            const seatPosition = table.viewer?.seat_position ?? null
            const joinedAtText = table.viewer?.joined_at
              ? formatDate.format(new Date(table.viewer.joined_at))
              : null
            const stackAmount = table.viewer?.chips ?? table.starting_stack
            const statusDescriptor = resolveStatus(table.status)
            const tableName = table.table_name || `Table #${table.table_id}`
            const isCreator = table.viewer?.is_creator ?? false

            return (
              <TableRow
                key={table.table_id}
                to={`/table/${table.table_id}`}
                tableName={tableName}
                chipLabel={`${table.small_blind}/${table.big_blind}`}
                subtext={table.host?.display_name ? `${t('lobby.fields.host')}: ${table.host.display_name}` : null}
                statusBadge={{
                  label: statusDescriptor.label,
                  tone: statusDescriptor.tone,
                }}
                badges={[
                  ...(table.visibility
                    ? ([
                        {
                          label: table.visibility === 'private' ? '🔒 ' + t('lobby.labels.visibility.private') : t('lobby.labels.visibility.public'),
                          tone: 'visibility',
                        },
                      ] as const)
                    : []),
                  ...(isCreator
                    ? ([{ label: t('lobby.labels.youHost'), tone: 'host' }] as const)
                    : []),
                  ...(seatPosition !== null
                    ? ([{ label: t('lobby.labels.seated'), tone: 'seated' }] as const)
                    : []),
                ]}
                meta={[
                  {
                    icon: '👥',
                    label: t('lobby.fields.players'),
                    value: `${table.player_count} / ${table.max_players}`,
                  },
                  {
                    icon: '💰',
                    label: t('lobby.fields.stack'),
                    value: `${stackAmount ?? '—'}`,
                  },
                  {
                    icon: '🕒',
                    label: t('lobby.fields.joined'),
                    value: joinedAtText || '—',
                  },
                ]}
                actionLabel={t('lobby.actions.view')}
                expiresAt={table.expires_at}
              />
            )
          })
        )}
      </LobbySection>

      <LobbySection
        id="public-tables"
        title={t('lobby.availableTables.title')}
        subtitle={t('lobby.availableTables.subtitle')}
        action={
          <Button variant="ghost" size="md" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? t('common.loading') : t('lobby.actions.refresh')}
          </Button>
        }
      >
        {prioritizedTables.length === 0 ? (
          <LobbyEmptyState title={t('lobby.availableTables.empty')} />
        ) : (
          prioritizedTables.map((table) => {
            const createdAtText = table.created_at ? formatDate.format(new Date(table.created_at)) : null
            const isSeated = table.viewer?.is_seated
            const isCreator = table.viewer?.is_creator
            const statusDescriptor = resolveStatus(table.status)

            return (
              <TableRow
                key={table.table_id}
                to={`/table/${table.table_id}`}
                tableName={table.table_name || `Table #${table.table_id}`}
                chipLabel={`${table.small_blind}/${table.big_blind}`}
                subtext={table.host?.display_name ? `${t('lobby.fields.host')}: ${table.host.display_name}` : null}
                statusBadge={{
                  label: statusDescriptor.label,
                  tone: statusDescriptor.tone,
                }}
                badges={[
                  ...(table.visibility
                    ? ([
                        {
                          label: table.visibility === 'private' ? '🔒 ' + t(`lobby.labels.visibility.${table.visibility}` as const) : t(`lobby.labels.visibility.${table.visibility}` as const),
                          tone: 'visibility',
                        },
                      ] as const)
                    : []),
                  ...(isSeated ? ([{ label: t('lobby.labels.seated'), tone: 'seated' }] as const) : []),
                  ...(isCreator ? ([{ label: t('lobby.labels.youHost'), tone: 'host' }] as const) : []),
                ]}
                muted={table.is_full && !isSeated}
                meta={[
                  {
                    icon: '👥',
                    label: t('lobby.fields.players'),
                    value: `${table.player_count}/${table.max_players}`,
                  },
                  {
                    icon: '💸',
                    label: t('lobby.fields.blinds'),
                    value: `${table.small_blind}/${table.big_blind}`,
                  },
                  {
                    icon: '📅',
                    label: t('lobby.fields.created'),
                    value: createdAtText || '—',
                  },
                ]}
                actionLabel={isSeated ? t('lobby.actions.view') : t('lobby.actions.join')}
                expiresAt={table.expires_at}
              />
            )
          })
        )}
      </LobbySection>
    </div>
  )
}
