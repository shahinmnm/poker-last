import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins, faLock, faPlay } from '@fortawesome/free-solid-svg-icons'

import { cn } from '../../utils/cn'
import { formatChips } from '../../utils/formatChips'
import type { TableSummary } from './mockLobbyData'

interface TableCardProps {
  table: TableSummary
  isFavorite?: boolean
  onToggleFavorite?: (tableId: number) => void
  onJoin: (table: TableSummary) => void
}

export default function TableCard({
  table,
  onJoin,
}: TableCardProps) {
  const { t } = useTranslation()
  const isFull = table.players >= table.maxPlayers
  const seatsOpen = Math.max(table.maxPlayers - table.players, 0)

  const stakesLabel = useMemo(() => {
    const small = table.stakesSmall
    const big = table.stakesBig
    if (
      typeof small !== 'number' ||
      typeof big !== 'number' ||
      !Number.isFinite(small) ||
      !Number.isFinite(big) ||
      small <= 0 ||
      big <= 0
    ) {
      return '--'
    }
    const symbol = table.currency === 'USD' ? '$' : ''
    return `${symbol}${formatChips(small)}/${symbol}${formatChips(big)}`
  }, [table.currency, table.stakesSmall, table.stakesBig])

  const typeLabel = useMemo(() => {
    if (table.format === 'headsUp') return t('lobbyNew.table.headsUp', 'Heads-Up')
    if (table.speed === 'turbo') return t('lobbyNew.table.turbo', 'Turbo')
    if (table.speed === 'deep') return t('lobbyNew.table.deep', 'Deep')
    return t('lobbyNew.table.standard', 'Standard')
  }, [table.format, table.speed, t])

  const handleCardClick = () => {
    if (isFull) return
    onJoin(table)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (isFull) return
      onJoin(table)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      aria-disabled={isFull}
      aria-label={t('lobbyNew.table.open', { defaultValue: 'Open table {{name}}', name: table.name })}
      className={cn('table-card-v2', isFull && 'table-card-v2--full')}
    >
      {/* Top row: Name (left) + Stakes badge (right) */}
      <div className="table-card-v2__top">
        <span className="table-card-v2__name">{table.name}</span>
        <span className="table-card-v2__stakes">
          <FontAwesomeIcon icon={faCoins} className="table-card-v2__stakes-icon" />
          {stakesLabel}
        </span>
      </div>

      {/* Bottom row: Seats + Type (left) + Join button (right) */}
      <div className="table-card-v2__bottom">
        <div className="table-card-v2__info">
          <span className="table-card-v2__seats">
            {table.players}/{table.maxPlayers}
            {!isFull && <span className="table-card-v2__open"> • {seatsOpen} {t('lobbyNew.table.seatsOpenShort', 'open')}</span>}
          </span>
          <span className="table-card-v2__type">{typeLabel}</span>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            if (isFull) return
            onJoin(table)
          }}
          disabled={isFull}
          className={cn('table-card-v2__join', isFull && 'table-card-v2__join--disabled')}
        >
          <FontAwesomeIcon icon={table.isPrivate ? faLock : faPlay} className="table-card-v2__join-icon" />
          <span className="table-card-v2__join-text">
            {isFull
              ? t('lobbyNew.table.status.full', 'Full')
              : t('lobbyNew.table.join', 'Join')}
          </span>
        </button>
      </div>
    </div>
  )
}
