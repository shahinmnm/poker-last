import { useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCoins, faLock, faPlay, faStar } from '@fortawesome/free-solid-svg-icons'

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
  isFavorite = false,
  onToggleFavorite,
  onJoin,
}: TableCardProps) {
  const { t } = useTranslation()
  const isFull = table.players >= table.maxPlayers
  const seatsOpen = Math.max(table.maxPlayers - table.players, 0)

  const occupancyPercent = useMemo(() => {
    if (!table.maxPlayers) return 0
    const ratio = Math.min(Math.max(table.players / table.maxPlayers, 0), 1)
    return Math.round(ratio * 100)
  }, [table.maxPlayers, table.players])

  const occupancyColor = useMemo(() => {
    if (occupancyPercent < 40) return 'var(--accent-emerald)'
    if (occupancyPercent < 80) return 'var(--accent-amber)'
    return 'var(--accent-red)'
  }, [occupancyPercent])

  const ringStyle = useMemo(
    () =>
      ({
        '--occupancy': `${occupancyPercent}%`,
        '--occupancy-color': occupancyColor,
      }) as CSSProperties,
    [occupancyColor, occupancyPercent],
  )

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
    if (table.format === 'headsUp') return t('lobbyNew.table.headsUp', 'HU')
    if (table.speed === 'turbo') return t('lobbyNew.table.turbo', 'Turbo')
    if (table.speed === 'deep') return t('lobbyNew.table.deep', 'Deep')
    return t('lobbyNew.table.standard', 'Standard')
  }, [table.format, table.speed, t])

  const buyInLabel = useMemo(() => {
    if (!table.minBuyIn && !table.maxBuyIn) return null
    const symbol = table.currency === 'USD' ? '$' : ''
    const min = typeof table.minBuyIn === 'number' ? `${symbol}${formatChips(table.minBuyIn)}` : null
    const max = typeof table.maxBuyIn === 'number' ? `${symbol}${formatChips(table.maxBuyIn)}` : null
    if (min && max) {
      return t('lobbyNew.table.buyInRangeShort', {
        defaultValue: 'Buy-in {{min}}-{{max}}',
        min,
        max,
      })
    }
    if (min) {
      return t('lobbyNew.table.buyInMinShort', {
        defaultValue: 'Buy-in {{min}}+',
        min,
      })
    }
    if (max) {
      return t('lobbyNew.table.buyInMaxShort', {
        defaultValue: 'Buy-in <={{max}}',
        max,
      })
    }
    return null
  }, [table.currency, table.maxBuyIn, table.minBuyIn, t])

  const seatsLabel = t('lobbyNew.table.seatsOpenShort', {
    defaultValue: '{{count}} open',
    count: seatsOpen,
  })

  const metaLine = [typeLabel, buyInLabel, seatsLabel].filter(Boolean).join(' | ')

  const normalizedStatus = table.status?.toLowerCase()
  const badges = useMemo(() => {
    const next: Array<{ label: string; tone: string }> = []
    if (table.isPrivate) {
      next.push({
        label: t('lobbyNew.table.status.private', 'PRIVATE'),
        tone: 'private',
      })
    }
    if (isFull) {
      next.push({
        label: t('lobbyNew.table.status.full', 'FULL'),
        tone: 'full',
      })
      return next
    }
    if (normalizedStatus && ['joining', 'starting'].includes(normalizedStatus)) {
      next.push({
        label: t('lobbyNew.table.status.joining', 'JOINING'),
        tone: 'joining',
      })
      return next
    }
    if (normalizedStatus && ['active', 'running', 'waiting'].includes(normalizedStatus)) {
      next.push({
        label: t('lobbyNew.table.status.running', 'RUNNING'),
        tone: 'running',
      })
    }
    return next
  }, [isFull, normalizedStatus, table.isPrivate, t])

  const visibleBadges = useMemo(() => {
    if (badges.length <= 2) return badges
    return [
      badges[0],
      { label: `+${badges.length - 1}`, tone: 'muted' },
    ]
  }, [badges])

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

  const occupancyText =
    isFull
      ? t('lobbyNew.table.status.full', 'FULL')
      : table.maxPlayers > 0
        ? `${seatsOpen}`
        : '--'
  const occupancyLabel = isFull ? t('lobbyNew.table.status.full', 'FULL') : t('lobbyNew.table.open', 'OPEN')
  const joinIcon = isFull ? faLock : table.isPrivate ? faLock : faPlay

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
      <div className="table-card-v2__occupancy">
        <div className="table-card-v2__occupancy-ring" style={ringStyle}>
          <span className="table-card-v2__occupancy-text ui-nowrap">{occupancyText}</span>
          <span className="table-card-v2__occupancy-label ui-nowrap">{occupancyLabel}</span>
        </div>
      </div>

      <div className="table-card-v2__content">
        <div className="table-card-v2__top">
          <span className="table-card-v2__name ui-nowrap" dir="auto">{table.name}</span>
          <span className="table-card-v2__stakes ui-nowrap">
            <FontAwesomeIcon icon={faCoins} className="table-card-v2__stakes-icon" />
            {stakesLabel}
          </span>
        </div>

        <div className="table-card-v2__bottom">
          <span className="table-card-v2__meta ui-nowrap">{metaLine}</span>
          {visibleBadges.length > 0 && (
            <div className="table-card-v2__badges">
              {visibleBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={cn('table-card-v2__badge ui-nowrap', `table-card-v2__badge--${badge.tone}`)}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="table-card-v2__actions">
        {onToggleFavorite && (
          <button
            type="button"
            className={cn('table-card-v2__fav', isFavorite && 'is-active')}
            aria-pressed={isFavorite}
            aria-label={t('lobbyNew.table.favorite', 'Favorite')}
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite(table.id)
            }}
          >
            <FontAwesomeIcon icon={faStar} />
          </button>
        )}
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
          <FontAwesomeIcon icon={joinIcon} className="table-card-v2__join-icon" />
          <span className="table-card-v2__join-text ui-nowrap">
            {isFull
              ? t('lobbyNew.table.status.full', 'FULL')
              : t('lobbyNew.table.join', 'Join')}
          </span>
        </button>
      </div>
    </div>
  )
}
