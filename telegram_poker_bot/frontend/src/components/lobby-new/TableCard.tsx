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

  const statusLabel = useMemo(() => {
    if (!table.status) return null
    const normalized = table.status.replace(/_/g, ' ')
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }, [table.status])

  const normalizedSpeed = speedLabel ?? t('lobbyNew.table.standard', 'Standard')
  const statusTone = useMemo(() => {
    const normalized = table.status?.toLowerCase()
    if (!normalized) return null
    if (['active', 'running', 'in_progress'].includes(normalized)) return 'success'
    if (['waiting', 'open'].includes(normalized)) return 'warning'
    if (['full', 'closed', 'finished'].includes(normalized)) return 'muted'
    return 'info'
  }, [table.status])

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

  const seatRatio = table.maxPlayers > 0 ? Math.min(table.players / table.maxPlayers, 1) : 0
  const seatPercent = Math.round(seatRatio * 100)
  const ringColor = isFull ? 'var(--chip-red)' : 'var(--chip-emerald)'
  const ringStyle = {
    background: `conic-gradient(${ringColor} ${seatPercent}%, rgba(255,255,255,0.12) 0)`,
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
      className={cn(
        'table-card',
        isFull ? 'table-card--full' : 'table-card--open',
      )}
    >
      <div className="table-card__seat" aria-hidden>
        <div className="table-card__seat-ring" style={ringStyle}>
          <div className="table-card__seat-core">
            <span className="table-card__seat-count tabular-nums">
              {table.players}/{table.maxPlayers}
            </span>
            <span className="table-card__seat-label">
              {t('lobbyNew.table.seatsOpen', 'seats')}
            </span>
          </div>
        </div>
        <div className="table-card__seat-meta">
          <span className="table-card__speed">{normalizedSpeed}</span>
          {statusTone && <FontAwesomeIcon icon={faCircle} className={cn('table-card__activity', `is-${statusTone}`)} />}
        </div>
      </div>

      <div className="table-card__main">
        <div className="table-card__headline">
          <div className="table-card__title-stack">
            <p className="table-card__name" dir="auto">
              {table.name}
            </p>
            <div className="table-card__status">
              {statusTone && <span className={cn('table-card__status-dot', `is-${statusTone}`)} aria-hidden />}
              <span className="table-card__status-label">
                {statusLabel || normalizedSpeed}
              </span>
            </div>
          </div>
          <span className="table-card__stakes tabular-nums">
            <FontAwesomeIcon icon={faCoins} className="table-card__stakes-icon" />
            {stakesLabel}
          </span>
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

        <div className="table-card__meta">
          <span className="table-card__meta-item tabular-nums">{buyInLabel}</span>
          <span className="table-card__meta-item tabular-nums">
            {table.players}/{table.maxPlayers} {t('lobbyNew.table.players', 'players')}
          </span>
          <span className="table-card__meta-item">{normalizedSpeed}</span>
        </div>
      </div>

      <div className="table-card__actions">
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
  )
}
