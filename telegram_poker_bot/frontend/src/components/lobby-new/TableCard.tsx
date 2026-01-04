import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircle, faCoins, faLock, faPlay, faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons'

import { cn } from '../../utils/cn'
import { formatChips } from '../../utils/formatChips'
import type { TableSummary } from './mockLobbyData'

interface TableCardProps {
  table: TableSummary
  isFavorite: boolean
  onToggleFavorite: (tableId: number) => void
  onJoin: (table: TableSummary) => void
}

export default function TableCard({
  table,
  isFavorite,
  onToggleFavorite,
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

  const buyInLabel = useMemo(() => {
    if (typeof table.minBuyIn === 'number' && typeof table.maxBuyIn === 'number') {
      const symbol = table.currency === 'USD' ? '$' : ''
      const min = `${symbol}${formatChips(table.minBuyIn)}`
      const max = `${symbol}${formatChips(table.maxBuyIn)}`
      return t('lobbyNew.table.buyInRange', {
        defaultValue: 'Buy-in {{min}}-{{max}}',
        min,
        max,
      })
    }
    return t('lobbyNew.table.buyInUnknown', { defaultValue: 'Buy-in --' })
  }, [table.currency, table.minBuyIn, table.maxBuyIn, t])

  const speedLabel = useMemo(() => {
    if (!table.speed || table.speed === 'standard') return null
    return table.speed === 'turbo'
      ? t('lobbyNew.table.turbo', 'Turbo')
      : t('lobbyNew.table.deep', 'Deep')
  }, [table.speed, t])

  const statusState = useMemo(() => {
    const normalized = table.status?.toLowerCase() ?? ''
    if (isFull) {
      return { label: t('lobbyNew.table.status.full', 'Full'), tone: 'muted' as const }
    }
    if (['active', 'running', 'in_progress'].includes(normalized)) {
      return { label: t('lobbyNew.table.status.running', 'Running'), tone: 'success' as const }
    }
    if (['waiting', 'open', 'starting'].includes(normalized)) {
      return { label: t('lobbyNew.table.status.open', 'Open'), tone: 'warning' as const }
    }
    return { label: t('lobbyNew.table.status.open', 'Open'), tone: 'warning' as const }
  }, [isFull, table.status, t])

  const normalizedSpeed = speedLabel ?? t('lobbyNew.table.standard', 'Standard')

  const badges = useMemo(() => {
    const items: Array<{ key: string; label: string; tone: 'amber' | 'red' | 'blue' }> = []
    if (table.speed === 'turbo') {
      items.push({ key: 'turbo', label: t('lobbyNew.table.turbo', 'Turbo'), tone: 'amber' })
    }
    if (table.speed === 'deep') {
      items.push({ key: 'deep', label: t('lobbyNew.table.deep', 'Deep'), tone: 'blue' })
    }
    if (table.isPrivate) {
      items.push({ key: 'private', label: t('lobbyNew.table.private', 'Private'), tone: 'amber' })
    }
    if (isFull) {
      items.push({ key: 'full', label: t('lobbyNew.table.status.full', 'Full'), tone: 'red' })
    }
    if (table.format === 'headsUp') {
      items.push({ key: 'headsUp', label: t('lobbyNew.table.headsUp', 'Heads-Up'), tone: 'blue' })
    }
    return items
  }, [isFull, table.format, table.isPrivate, table.speed, t])

  const visibleBadges = badges.slice(0, 2)
  const extraBadgeCount = Math.max(badges.length - visibleBadges.length, 0)

  const seatRatio = table.maxPlayers > 0 ? Math.max(seatsOpen / table.maxPlayers, 0) : 0
  const seatPercent = Math.round(Math.min(seatRatio, 1) * 100)
  const ringColor = isFull ? 'rgba(239, 75, 75, 0.7)' : 'rgba(30, 198, 120, 0.7)'
  const ringStyle = {
    backgroundImage: `conic-gradient(${ringColor} ${seatPercent}%, rgba(255,255,255,0.08) 0)`,
  }

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
      className={cn('table-card', isFull ? 'table-card--full' : 'table-card--open')}
    >
      <div className="table-card__topline">
        <div className="table-card__stakes tabular-nums">
          <FontAwesomeIcon icon={faCoins} className="table-card__stakes-icon" />
          <span className="table-card__stakes-value">{stakesLabel}</span>
        </div>
        <div className="table-card__cta-group">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (isFull) return
              onJoin(table)
            }}
            className={cn('table-card__join', isFull && 'is-disabled')}
            disabled={isFull}
          >
            <FontAwesomeIcon icon={table.isPrivate ? faLock : faPlay} className="table-card__join-icon" />
            <span className="table-card__join-label">
              {isFull
                ? t('lobbyNew.table.status.full', 'Full')
                : table.isPrivate
                  ? t('lobbyNew.table.private', 'Private')
                  : t('lobbyNew.table.join', 'Join')}
            </span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite(table.id)
            }}
            className="table-card__favorite"
            aria-label={t('lobbyNew.table.favorite', 'Favorite')}
            aria-pressed={isFavorite}
          >
            <FontAwesomeIcon icon={isFavorite ? faStarSolid : faStarRegular} />
          </button>
        </div>
      </div>

      <div className="table-card__body">
        <div className="table-card__main">
          <div className="table-card__headline">
            <div className="table-card__title-stack">
              <p className="table-card__name" dir="auto">
                {table.name}
              </p>
              <div className="table-card__status">
                <span className="table-card__status-label">{statusState.label}</span>
                <span className="table-card__status-separator">•</span>
                <span className="table-card__status-label tabular-nums">
                  {seatsOpen} {t('lobbyNew.table.seatsOpenShort', 'open')}
                </span>
                {statusState.tone && (
                  <FontAwesomeIcon
                    icon={faCircle}
                    className={cn('table-card__activity', `is-${statusState.tone}`)}
                  />
                )}
                <span className="table-card__speed">{normalizedSpeed}</span>
              </div>
            </div>
            <div className="table-card__badges">
              {visibleBadges.map((badge) => (
                <span
                  key={badge.key}
                  className={cn('table-card__badge', `table-card__badge--${badge.tone}`)}
                >
                  {badge.label}
                </span>
              ))}
              {extraBadgeCount > 0 && (
                <span className="table-card__badge table-card__badge--muted">
                  +{extraBadgeCount}
                </span>
              )}
            </div>
          </div>

          <div className="table-card__meta">
            <span className="table-card__meta-item tabular-nums">{buyInLabel}</span>
            <span className="table-card__meta-item">
              {table.format === 'headsUp'
                ? t('lobbyNew.tabs.headsUpShort', 'HU')
                : t('lobbyNew.tabs.cashShort', 'Cash')}
            </span>
          </div>
        </div>

        <div className="table-card__seat" aria-hidden>
          <div className="table-card__seat-ring" style={ringStyle}>
            <div className="table-card__seat-core">
              <span className="table-card__seat-count tabular-nums">
                {seatsOpen}
              </span>
              <span className="table-card__seat-label">
                {t('lobbyNew.table.seatsOpen', 'open')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
