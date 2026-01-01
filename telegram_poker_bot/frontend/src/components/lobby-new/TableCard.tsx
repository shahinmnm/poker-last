import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons'
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

  const statusKey = isFull ? 'full' : table.isPrivate ? 'private' : 'joining'
  const statusLabel = {
    joining: t('lobbyNew.table.status.joining', 'Joining'),
    full: t('lobbyNew.table.status.full', 'Full'),
    private: t('lobbyNew.table.status.private', 'Private'),
  }[statusKey]

  const statusClass = {
    joining: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
    full: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    private: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  }[statusKey]

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
      const min = formatChips(table.minBuyIn)
      const max = formatChips(table.maxBuyIn)
      return t('lobbyNew.table.buyInRange', {
        defaultValue: 'Buy-in {{min}}-{{max}}',
        min,
        max,
      })
    }
    return t('lobbyNew.table.buyInUnknown', { defaultValue: 'Buy-in --' })
  }, [table.minBuyIn, table.maxBuyIn, t])

  const avgPotLabel = useMemo(() => {
    if (typeof table.avgPot !== 'number') {
      return t('lobbyNew.table.avgPotUnknown', { defaultValue: 'Avg pot --' })
    }
    const symbol = table.currency === 'USD' ? '$' : ''
    return t('lobbyNew.table.avgPot', {
      defaultValue: 'Avg pot {{amount}}',
      amount: `${symbol}${formatChips(table.avgPot)}`,
    })
  }, [table.avgPot, table.currency, t])

  const speedLabel = useMemo(() => {
    if (!table.speed || table.speed === 'standard') return null
    return table.speed === 'turbo'
      ? t('lobbyNew.table.turbo', 'Turbo')
      : t('lobbyNew.table.deep', 'Deep')
  }, [table.speed, t])

  const activity = useMemo(() => {
    if (!table.lastActiveAt || !Number.isFinite(table.lastActiveAt)) {
      return {
        label: t('lobbyNew.table.activity.unknown', '--'),
        dot: 'bg-[var(--border-3)]',
        text: 'text-[var(--text-3)]',
      }
    }
    const deltaMs = Date.now() - table.lastActiveAt
    if (deltaMs <= 120000) {
      return {
        label: t('lobbyNew.table.activity.hot', 'Hot'),
        dot: 'bg-[var(--success)]',
        text: 'text-[var(--success)]',
      }
    }
    if (deltaMs <= 420000) {
      return {
        label: t('lobbyNew.table.activity.active', 'Active'),
        dot: 'bg-[var(--warning)]',
        text: 'text-[var(--warning)]',
      }
    }
    return {
      label: t('lobbyNew.table.activity.idle', 'Idle'),
      dot: 'bg-[var(--border-3)]',
      text: 'text-[var(--text-3)]',
    }
  }, [table.lastActiveAt, t])

  const seatDots = useMemo(
    () =>
      Array.from({ length: table.maxPlayers }, (_, index) => {
        const filled = index < table.players
        const fillClass = isFull ? 'bg-[var(--danger)]' : 'bg-[var(--success)]'
        return (
          <span
            key={`${table.id}-seat-${index}`}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              filled ? fillClass : 'bg-[var(--border-3)]',
            )}
          />
        )
      }),
    [isFull, table.id, table.maxPlayers, table.players],
  )

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
        'group relative w-full min-h-[60px] rounded-2xl p-3 transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-1)]',
        'active:translate-y-[1px] active:shadow-[0_6px_16px_rgba(0,0,0,0.3)]',
        isFull ? 'cursor-not-allowed opacity-80' : 'cursor-pointer',
      )}
      style={{
        background:
          'linear-gradient(135deg, rgba(5, 36, 22, 0.95), rgba(2, 22, 14, 0.92) 55%, rgba(1, 16, 11, 0.98))',
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.28)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className="truncate text-[clamp(13px,1.8vw,15px)] font-semibold text-[var(--text-2)]"
              dir="auto"
            >
              {table.name}
            </p>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]',
                statusClass,
              )}
            >
              {statusLabel}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[clamp(15px,2.3vw,17px)] font-semibold text-[var(--warning)] tabular-nums">
              {stakesLabel}
            </span>
            <div className="flex items-center gap-2 text-[clamp(11px,1.6vw,13px)] text-[var(--text-2)] tabular-nums">
              <span>
                {table.players}/{table.maxPlayers}
              </span>
              <span className="flex items-center gap-1">{seatDots}</span>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[clamp(11px,1.5vw,13px)] text-[var(--text-3)]">
            <span className="tabular-nums">{buyInLabel}</span>
            <span className="tabular-nums">{avgPotLabel}</span>
            {speedLabel && (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-2)]">
                {speedLabel}
              </span>
            )}
            {table.isPrivate && statusKey !== 'private' && (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-2)]">
                {t('lobbyNew.table.private', 'Private')}
              </span>
            )}
            {table.format === 'headsUp' && (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-2)]">
                {t('lobbyNew.table.headsUp', 'Heads-Up')}
              </span>
            )}
            <span className={cn('flex items-center gap-1 font-semibold', activity.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', activity.dot)} aria-hidden />
              {activity.label}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleFavorite(table.id)
          }}
          className="group inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
          aria-label={t('lobbyNew.table.favorite', 'Favorite')}
          aria-pressed={isFavorite}
        >
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-2)] bg-[var(--surface-2)] text-[12px] transition',
              'group-active:scale-95',
              isFavorite ? 'text-[var(--warning)]' : 'text-[var(--text-3)] hover:text-[var(--text-1)]',
            )}
          >
            <FontAwesomeIcon icon={isFavorite ? faStarSolid : faStarRegular} />
          </span>
        </button>
      </div>
    </div>
  )
}
