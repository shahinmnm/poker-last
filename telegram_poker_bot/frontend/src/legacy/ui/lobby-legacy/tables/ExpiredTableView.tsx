import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import Card from '../../../../components/ui/Card'
import Button from '../../../../components/ui/Button'
import { extractRuleSummary } from '../../../../utils/tableRules'

export interface ExpiredTableViewProps {
  tableName?: string | null
  templateId?: number | string | null
  templateConfig?: Record<string, any> | null
  maxPlayers?: number
  isPrivate?: boolean
}

export default function ExpiredTableView({
  tableName,
  templateId,
  templateConfig,
  maxPlayers,
  isPrivate,
}: ExpiredTableViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleBackToLobby = () => {
    navigate('/lobby')
  }

  const handleCreateSimilar = () => {
    const params = new URLSearchParams()
    if (templateId) params.set('template_id', String(templateId))
    if (maxPlayers) params.set('max_players', maxPlayers.toString())
    if (isPrivate !== undefined) params.set('visibility', isPrivate ? 'private' : 'public')
    
    navigate(`/games/create?${params.toString()}`)
  }

  const rules = extractRuleSummary(
    templateConfig
      ? { id: templateId ?? undefined, table_type: '', config: templateConfig }
      : null,
    { max_players: maxPlayers, table_name: tableName ?? null },
  )

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-lg text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--danger-soft)]">
            <span className="text-3xl">⏱️</span>
          </div>
          <h2 className="text-page-title mb-2">{t('table.expiration.expired')}</h2>
          <p className="text-body text-[color:var(--text-muted)]">
            {t('table.expiration.expiredMessage')}
          </p>
          {tableName && (
            <p className="mt-3 text-sm font-semibold text-[color:var(--text-primary)]">
              {tableName}
            </p>
          )}
          {rules.stakesLabel && (
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              {t('table.meta.stakes', { defaultValue: 'Stakes' })}: {rules.stakesLabel}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="secondary" onClick={handleBackToLobby}>
            {t('table.expiration.expiredBackToLobby')}
          </Button>
          {templateId && (
            <Button variant="primary" onClick={handleCreateSimilar}>
              {t('table.expiration.expiredCreateNew')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
