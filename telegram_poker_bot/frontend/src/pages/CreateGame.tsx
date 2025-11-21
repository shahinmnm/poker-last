import { FormEvent, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import Toggle from '../components/ui/Toggle'
import { useTelegram } from '../hooks/useTelegram'
import { createTable, type TableSummary, type TableVisibility } from '../services/tables'

interface CreateTableFormState {
  tableName: string
  smallBlind: number
  bigBlind: number
  startingStack: number
  maxPlayers: number
  visibility: TableVisibility
  autoSeatHost: boolean
  autoStart: boolean
  tableMode: 'casual' | 'turbo' | 'ranked'
}

type ViewState = 'idle' | 'loading' | 'success' | 'error'

export default function CreateGamePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { initData, ready } = useTelegram()
  const [searchParams] = useSearchParams()
  const tips = t('createGame.tips', { returnObjects: true }) as string[]

  // Get initial mode from URL parameter
  const initialMode = searchParams.get('mode') as TableVisibility | null
  const defaultVisibility: TableVisibility = initialMode === 'public' ? 'public' : initialMode === 'private' ? 'private' : 'public'

  const [formState, setFormState] = useState<CreateTableFormState>({
    tableName: '',
    smallBlind: 25,
    bigBlind: 50,
    startingStack: 10000,
    maxPlayers: 6,
    visibility: defaultVisibility,
    autoSeatHost: defaultVisibility === 'public',
    autoStart: false,
    tableMode: 'casual',
  })
  const [status, setStatus] = useState<ViewState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tableResult, setTableResult] = useState<TableSummary | null>(null)

  const handleFieldChange = useCallback(
    (field: keyof CreateTableFormState, value: string | number | boolean) => {
      setFormState((prev) => {
        if (field === 'visibility') {
          const nextVisibility = value as TableVisibility
          const autoSeatHost = nextVisibility === 'public' ? prev.autoSeatHost || true : false
          return {
            ...prev,
            visibility: nextVisibility,
            autoSeatHost,
          }
        }
        return {
          ...prev,
          [field]: value,
        }
      })
    },
    [],
  )

  const submitDisabled = status === 'loading' || !ready

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!initData) {
        setStatus('error')
        setErrorMessage(t('createGame.errors.missingAuth'))
        return
      }

      setStatus('loading')
      setErrorMessage(null)

      try {
        const response = await createTable(
          {
            tableName: formState.tableName.trim() || undefined,
            smallBlind: formState.smallBlind,
            bigBlind: Math.max(formState.bigBlind, formState.smallBlind * 2),
            startingStack: formState.startingStack,
            maxPlayers: formState.maxPlayers,
            visibility: formState.visibility,
            autoSeatHost: formState.autoSeatHost,
          },
          initData,
        )
        setTableResult(response)
        setStatus('success')
        navigate(`/table/${response.table_id}`, { replace: true })
      } catch (error) {
        console.error('Failed to create table', error)
        setErrorMessage(t('createGame.errors.requestFailed'))
        setStatus('error')
      }
    },
    [formState, initData, navigate, t],
  )

  const resolvedVisibility = useMemo(() => {
    if (!tableResult) {
      return formState.visibility
    }
    if (typeof tableResult.visibility === 'string') {
      return tableResult.visibility as TableVisibility
    }
    if (tableResult.is_public != null) {
      return tableResult.is_public ? 'public' : 'private'
    }
    if (tableResult.is_private != null) {
      return tableResult.is_private ? 'private' : 'public'
    }
    return formState.visibility
  }, [formState.visibility, tableResult])

  const visibilitySummary = resolvedVisibility === 'public'
    ? t('createGame.summary.public')
    : t('createGame.summary.private')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('createGame.title')}
        subtitle={t('createGame.description')}
      />

      <Card>
        <form className="space-y-[var(--space-lg)]" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="font-medium text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-label)' }} htmlFor="table-name">
              {t('createGame.form.name')}
            </label>
            <input
              id="table-name"
              type="text"
              value={formState.tableName}
              onChange={(event) => handleFieldChange('tableName', event.target.value)}
              placeholder={t('createGame.form.namePlaceholder') ?? ''}
              className="w-full border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)' }}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[color:var(--text-main)] font-medium" style={{ fontSize: 'var(--fs-label)' }}>
                {t('createGame.form.visibility')}
              </span>
              <span className="text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-caption)' }}>
                {formState.visibility === 'public'
                  ? t('createGame.form.visibilityOptions.public.description', 'Anyone can join')
                  : t('createGame.form.visibilityOptions.private.description', 'Invite code only')}
              </span>
            </div>
            <Toggle
              checked={formState.visibility === 'public'}
              onChange={(checked) => handleFieldChange('visibility', checked ? 'public' : 'private')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="font-medium text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-label)' }} htmlFor="small-blind">
                {t('createGame.form.smallBlind')}
              </label>
              <input
                id="small-blind"
                type="number"
                min={5}
                value={formState.smallBlind}
                onChange={(event) => handleFieldChange('smallBlind', Number(event.target.value))}
                className="w-full border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
                style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)' }}
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-label)' }} htmlFor="big-blind">
                {t('createGame.form.bigBlind')}
              </label>
              <input
                id="big-blind"
                type="number"
                min={formState.smallBlind * 2}
                value={formState.bigBlind}
                onChange={(event) => handleFieldChange('bigBlind', Number(event.target.value))}
                className="w-full border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
                style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)' }}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="font-medium text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-label)' }} htmlFor="starting-stack">
                {t('createGame.form.startingStack')}
              </label>
              <input
                id="starting-stack"
                type="number"
                min={1000}
                step={500}
                value={formState.startingStack}
                onChange={(event) => handleFieldChange('startingStack', Number(event.target.value))}
                className="w-full border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
                style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)' }}
              />
            </div>
            <div className="space-y-2">
              <label className="font-medium text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-label)' }} htmlFor="max-players">
                {t('createGame.form.maxPlayers')}
              </label>
              <input
                id="max-players"
                type="number"
                min={2}
                max={9}
                value={formState.maxPlayers}
                onChange={(event) => handleFieldChange('maxPlayers', Number(event.target.value))}
                className="w-full border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
                style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)' }}
              />
            </div>
          </div>

          <label className="flex items-center justify-between border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)]" style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)' }}>
            <span>{t('createGame.form.autoSeatHost')}</span>
            <input
              type="checkbox"
              checked={formState.autoSeatHost}
              onChange={(event) => handleFieldChange('autoSeatHost', event.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--surface-border)] text-[color:var(--accent-start)] focus:ring-[color:var(--accent-start)]"
            />
          </label>

          <label className="flex items-center justify-between border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)]" style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)', opacity: 0.6 }}>
            <span>{t('createGame.form.autoStart')}</span>
            <input
              type="checkbox"
              disabled
              checked={formState.autoStart}
              onChange={(event) => handleFieldChange('autoStart', event.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--surface-border)] text-[color:var(--accent-start)] focus:ring-[color:var(--accent-start)]"
            />
          </label>

          <div className="space-y-2">
            <label className="font-medium text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-label)' }} htmlFor="table-mode">
              {t('createGame.form.tableMode')} ({t('common.comingSoon')})
            </label>
            <select
              id="table-mode"
              disabled
              value={formState.tableMode}
              onChange={(event) => handleFieldChange('tableMode', event.target.value)}
              className="w-full border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)', opacity: 0.6 }}
            >
              <option value="casual">{t('createGame.form.modeOptions.casual')}</option>
              <option value="turbo">{t('createGame.form.modeOptions.turbo')}</option>
              <option value="ranked">{t('createGame.form.modeOptions.ranked')}</option>
            </select>
          </div>

          {status === 'error' && errorMessage && (
            <div className="border border-red-400/40 bg-red-500/10 px-4 py-3 text-red-200" style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)' }}>
              {errorMessage}
            </div>
          )}

          <Button type="submit" block size="lg" disabled={submitDisabled} glow>
            {status === 'loading' ? t('common.loading') : t('createGame.form.button')}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">{t('createGame.tipsTitle')}</h2>
        <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-muted)]">
          {tips.map((tip, index) => (
            <li key={index}>• {tip}</li>
          ))}
        </ul>
      </Card>

      {status === 'success' && tableResult && (
        <Card className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-[color:var(--text-primary)]">{t('createGame.successTitle')}</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">{visibilitySummary}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                {t('createGame.summary.tableId')}
              </span>
              <p className="text-lg font-semibold text-[color:var(--text-primary)]">#{tableResult.table_id}</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                {t('createGame.summary.tableName')}
              </span>
              <p className="text-lg font-semibold text-[color:var(--text-primary)]">
                {tableResult.table_name || t('createGame.summary.defaultTableName')}
              </p>
            </div>
          </div>

          {resolvedVisibility === 'private' ? (
            <p className="rounded-2xl border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-sm text-[color:var(--text-muted)]">
              {t('createGame.summary.inviteHint', { code: tableResult.table_id })}
            </p>
          ) : (
            <p className="rounded-2xl border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-sm text-[color:var(--text-muted)]">
              {t('createGame.summary.publicHint')}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              size="lg"
              variant="primary"
              glow
              className="sm:w-auto"
              onClick={() => navigate(`/table/${tableResult.table_id}`)}
            >
              {t('createGame.summary.openTable')}
            </Button>
            <Link
              to="/lobby"
              className="app-button app-button--ghost app-button--md text-center sm:w-auto"
            >
              {t('createGame.summary.backToLobby')}
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
