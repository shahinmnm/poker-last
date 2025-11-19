import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import Card from '../ui/Card'
import Button from '../ui/Button'

export interface ExpiredTableViewProps {
  tableName?: string | null
  smallBlind?: number
  bigBlind?: number
  startingStack?: number
  maxPlayers?: number
  isPrivate?: boolean
}

export default function ExpiredTableView({
  tableName,
  smallBlind,
  bigBlind,
  startingStack,
  maxPlayers,
  isPrivate,
}: ExpiredTableViewProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const handleBackToLobby = () => {
    navigate('/lobby')
  }

  const handleCreateSimilar = () => {
    // Navigate to create page with pre-filled params if we have them
    const params = new URLSearchParams()
    if (smallBlind) params.set('small_blind', smallBlind.toString())
    if (bigBlind) params.set('big_blind', bigBlind.toString())
    if (startingStack) params.set('starting_stack', startingStack.toString())
    if (maxPlayers) params.set('max_players', maxPlayers.toString())
    if (isPrivate !== undefined) params.set('visibility', isPrivate ? 'private' : 'public')
    
    navigate(`/games/create?${params.toString()}`)
  }

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
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="secondary" onClick={handleBackToLobby}>
            {t('table.expiration.expiredBackToLobby')}
          </Button>
          {(smallBlind || bigBlind || startingStack) && (
            <Button variant="primary" onClick={handleCreateSimilar}>
              {t('table.expiration.expiredCreateNew')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
