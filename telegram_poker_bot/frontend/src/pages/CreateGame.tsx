import { FormEvent, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import PageHeader from '../components/ui/PageHeader'
import { useTelegram } from '../hooks/useTelegram'
import { createTable, type TableSummary } from '../services/tables'

interface CreateTableFormState {
  templateId: number | ''
  autoSeatHost: boolean
}

type ViewState = 'idle' | 'loading' | 'success' | 'error'

export default function CreateGamePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { initData, ready } = useTelegram()
  const [searchParams] = useSearchParams()
  const tips = t('createGame.tips', { returnObjects: true }) as string[]

  const initialTemplateParam = searchParams.get('template_id') || searchParams.get('templateId')
  const parsedTemplateId = initialTemplateParam ? Number(initialTemplateParam) : Number.NaN

  const [formState, setFormState] = useState<CreateTableFormState>({
    templateId: Number.isFinite(parsedTemplateId) ? parsedTemplateId : '',
    autoSeatHost: true,
  })
  const [status, setStatus] = useState<ViewState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tableResult, setTableResult] = useState<TableSummary | null>(null)

  const handleFieldChange = useCallback(
    (field: keyof CreateTableFormState, value: string | number | boolean) => {
      setFormState((prev) => ({
        ...prev,
        [field]:
          field === 'templateId'
            ? typeof value === 'number'
              ? value
              : value === ''
                ? ''
                : Number(value)
            : value,
      }))
    },
    [],
  )

  const submitDisabled = status === 'loading' || !ready || formState.templateId === ''

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
        const templateId =
          typeof formState.templateId === 'number'
            ? formState.templateId
            : Number(formState.templateId)

        if (!Number.isFinite(templateId) || templateId <= 0) {
          setStatus('error')
          setErrorMessage(t('createGame.errors.templateRequired', { defaultValue: 'Template ID is required' }))
          return
        }

        const response = await createTable(
          {
            templateId,
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
      return null
    }
    if (typeof tableResult.visibility === 'string') {
      return tableResult.visibility
    }
    if (tableResult.is_public != null) {
      return tableResult.is_public ? 'public' : 'private'
    }
    if (tableResult.is_private != null) {
      return tableResult.is_private ? 'private' : 'public'
    }
    return null
  }, [tableResult])

  const visibilitySummary =
    resolvedVisibility === 'private' ? t('createGame.summary.private') : t('createGame.summary.public')

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('createGame.title')}
        subtitle={t('createGame.description')}
      />

      <Card>
        <form className="space-y-[var(--space-lg)]" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="font-medium text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-label)' }} htmlFor="template-id">
              {t('createGame.form.templateId', { defaultValue: 'Template ID' })}
            </label>
            <input
              id="template-id"
              type="number"
              min={1}
              value={formState.templateId}
              onChange={(event) => handleFieldChange('templateId', event.target.value ? Number(event.target.value) : '')}
              placeholder={t('createGame.form.templatePlaceholder', { defaultValue: 'Enter template ID' }) ?? ''}
              className="w-full border border-[color:var(--surface-border)] bg-transparent px-4 py-3 text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-soft)]"
              style={{ borderRadius: 'var(--radius-xl)', fontSize: 'var(--fs-body)' }}
            />
            <p className="text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-caption)' }}>
              {t('createGame.form.templateHint', { defaultValue: 'Select an existing table template to use its rules.' })}
            </p>
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

          <div className="rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)] px-4 py-3 text-[color:var(--text-muted)]" style={{ fontSize: 'var(--fs-caption)' }}>
            {t('createGame.form.templateNotice', {
              defaultValue: 'Blinds, stacks, and other rules now come from the selected template configuration.',
            })}
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
