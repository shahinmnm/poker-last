import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons'

import Button from '../ui/Button'
import { formatChips } from '../../utils/formatChips'
import type { TableSummary } from './mockLobbyData'

interface TableCardProps {
  table: TableSummary
  isFavorite: boolean
  onToggleFavorite: (tableId: number) => void
  onJoin: (table: TableSummary) => void
  actionLabel?: string
}

const badgeBase =
  'rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-3)] tabular-nums'

export default function TableCard({
  table,
  isFavorite,
  onToggleFavorite,
  onJoin,
  actionLabel,
}: TableCardProps) {
  const { t } = useTranslation()
  const isFull = table.players >= table.maxPlayers

  const stakesLabel = useMemo(() => {
    const symbol = table.currency === 'USD' ? '$' : ''
    return `${symbol}${formatChips(table.stakesSmall)}/${symbol}${formatChips(table.stakesBig)}`
  }, [table.currency, table.stakesSmall, table.stakesBig])

  const buyInLabel = useMemo(() => {
    const min = formatChips(table.minBuyIn)
    const max = formatChips(table.maxBuyIn)
    return t('lobbyNew.table.buyInRange', {
      defaultValue: 'Buy-in {{min}}-{{max}}',
      min,
      max,
    })
  }, [table.minBuyIn, table.maxBuyIn, t])

  const seatDots = useMemo(
    () =>
      Array.from({ length: table.maxPlayers }, (_, index) => {
        const filled = index < table.players
        return (
          <span
            key={`${table.id}-seat-${index}`}
            className={`h-2 w-2 rounded-full ${filled ? 'bg-[var(--text-2)]' : 'bg-[var(--border-3)]'}`}
          />
        )
      }),
    [table.id, table.maxPlayers, table.players],
  )

  const speedLabels: Record<'turbo' | 'deep', string> = {
    turbo: t('lobbyNew.table.turbo', 'Turbo'),
    deep: t('lobbyNew.table.deep', 'Deep'),
  }

  const badges = [
    table.speed !== 'standard' ? speedLabels[table.speed] : null,
    table.format === 'headsUp' ? t('lobbyNew.table.headsUp', 'Heads-Up') : null,
    table.isPrivate ? t('lobbyNew.table.private', 'Private') : null,
  ].filter(Boolean) as string[]

  return (
    <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text-2)]" dir="auto">
              {table.name}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="text-lg font-semibold text-[var(--text-1)] tabular-nums">
                {stakesLabel}
              </span>
              <div className="flex items-center gap-2 text-sm text-[var(--text-2)] tabular-nums">
                <span>
                  {table.players}/{table.maxPlayers}
                </span>
                <span className="flex items-center gap-1">{seatDots}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-3)]">
            <span className={badgeBase}>{buyInLabel}</span>
            {badges.map((badge) => (
              <span key={`${table.id}-${badge}`} className={badgeBase}>
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Button
            size="md"
            variant={isFull ? 'secondary' : 'primary'}
            className="min-h-[44px] px-5"
            disabled={isFull}
            onClick={() => onJoin(table)}
          >
            {isFull
              ? t('lobbyNew.table.watching', 'Watching')
              : actionLabel || t('lobbyNew.table.join', 'Join')}
          </Button>

          <button
            type="button"
            onClick={() => onToggleFavorite(table.id)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] text-[var(--text-2)] transition hover:text-[var(--text-1)]"
            aria-label={t('lobbyNew.table.favorite', 'Favorite')}
            aria-pressed={isFavorite}
          >
            <FontAwesomeIcon icon={isFavorite ? faStarSolid : faStarRegular} />
          </button>
        </div>
      </div>
    </div>
  )
}
