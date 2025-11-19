import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { cn } from '../../utils/cn'
import { getTimeRemaining } from '../../utils/countdown'
import type { TableStatusTone } from '../lobby/types'

interface MetaItem {
  icon: string | IconDefinition
  label: string
  value: string
}

export type SummaryBadgeTone = TableStatusTone | 'host' | 'seated' | 'visibility'

export interface SummaryBadgeDescriptor {
  label: string
  tone: SummaryBadgeTone
}

export interface TableSummaryProps {
  tableName: string
  chipLabel: string
  statusBadge: SummaryBadgeDescriptor
  meta: MetaItem[]
  badges?: SummaryBadgeDescriptor[]
  muted?: boolean
  subtext?: string | null
  actionLabel?: string
  expiresAt?: string | null
  href?: string
  leadingIcon?: React.ReactNode
}

const toneClassMap: Record<SummaryBadgeTone, string> = {
  running: 'bg-[color:var(--color-status-running-bg)] text-[color:var(--color-status-running-text)]',
  waiting: 'bg-[color:var(--color-status-waiting-bg)] text-[color:var(--color-status-waiting-text)]',
  finished: 'bg-[color:var(--color-status-finished-bg)] text-[color:var(--color-status-finished-text)]',
  host: 'bg-[color:var(--color-role-host-bg)] text-[color:var(--color-role-host-text)]',
  seated: 'bg-[color:var(--color-role-seated-bg)] text-[color:var(--color-role-seated-text)]',
  visibility: 'bg-[color:var(--color-border)]/40 text-[color:var(--color-text)]',
}

export function TableSummary({
  tableName,
  chipLabel,
  statusBadge,
  meta,
  badges = [],
  muted,
  subtext,
  actionLabel,
  expiresAt,
  href,
  leadingIcon,
}: TableSummaryProps) {
  const [timeRemaining, setTimeRemaining] = useState(() => getTimeRemaining(expiresAt ?? null))

  useEffect(() => {
    if (!expiresAt) {
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(expiresAt))
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const isExpiringSoon = timeRemaining.isExpiringSoon
  const className = cn(
    'block rounded-[var(--radius-xl)] border p-[var(--space-md)] shadow-sm transition',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent-start)]',
    isExpiringSoon
      ? 'border-[color:var(--color-danger-glass-border)] bg-[color:var(--color-danger-glass)] hover:border-[color:var(--color-danger)]'
      : 'border-[color:var(--color-border-glass)] hover:border-[color:var(--color-accent-soft)]',
    muted && 'opacity-70',
  )
  
  const cardStyle = {
    background: 'var(--bg-glass)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: 'var(--shadow-soft)',
  }

  const content = (
    <>
      <div className="flex items-start justify-between gap-[var(--space-sm)]">
        <div className="min-w-0 flex-1 space-y-[calc(var(--space-md)+var(--space-xs))]">
          <div className="flex items-start justify-between gap-[var(--space-sm)]">
            <div className="min-w-0 flex-1 space-y-[var(--space-xs)]">
              <div className="flex items-center gap-[calc(var(--space-xs)+var(--space-xs))]">
                {leadingIcon && <span className="text-base text-[color:var(--color-text-muted)]">{leadingIcon}</span>}
                <h3 className="truncate text-[var(--font-size-base)] font-semibold leading-tight text-[color:var(--color-text)]">
                  {tableName}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center rounded-[var(--radius-pill)] px-[var(--space-sm)] py-[var(--space-xs)] text-[var(--font-size-xs)] font-semibold uppercase tracking-wider text-[color:var(--color-text)]',
                    'bg-[color:var(--color-surface)]/80 border border-[color:var(--color-border)]',
                  )}
                >
                  {chipLabel}
                </span>
              </div>
              {subtext && <p className="truncate text-[11px] text-[color:var(--color-text-muted)]">{subtext}</p>}
            </div>
            {actionLabel && (
              <div className="flex shrink-0 items-center gap-[calc(var(--space-xs)+var(--space-xs))] text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
                {actionLabel}
                {href && <span aria-hidden>›</span>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-[calc(var(--space-xs)+var(--space-xs))]">
            <span
              className={cn(
                'inline-flex items-center rounded-[var(--radius-pill)] px-[var(--space-sm)] py-[var(--space-xs)] text-[9px] font-semibold uppercase tracking-wider',
                toneClassMap[statusBadge.tone],
              )}
            >
              {statusBadge.label}
            </span>
            {badges.map((badge) => (
              <span
                key={`${badge.label}-${badge.tone}`}
                className={cn(
                  'inline-flex items-center rounded-[var(--radius-pill)] px-[var(--space-sm)] py-[var(--space-xs)] text-[9px] font-semibold uppercase tracking-wider',
                  toneClassMap[badge.tone],
                )}
              >
                {badge.label}
              </span>
            ))}
            {expiresAt && !timeRemaining.isExpired && (
              <span
                className={cn(
                  'inline-flex items-center rounded-[var(--radius-pill)] px-[var(--space-sm)] py-[var(--space-xs)] text-[9px] font-semibold',
                  isExpiringSoon
                    ? 'bg-[color:var(--color-danger)] text-white'
                    : 'bg-[color:var(--color-surface)]/60 text-[color:var(--color-text-muted)]',
                )}
              >
                ⏱ {timeRemaining.minutes}:{String(timeRemaining.seconds).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-[var(--space-sm)] grid grid-cols-2 gap-x-[var(--space-md)] gap-y-[calc(var(--space-xs)+var(--space-xs))] text-[var(--font-size-sm)] text-[color:var(--color-text-muted)] sm:grid-cols-3">
        {meta.map((item) => {
          const isFontAwesomeIcon = typeof item.icon === 'object' && 'iconName' in item.icon
          return (
            <div key={`${item.label}-${item.value}`} className="flex items-center gap-[calc(var(--space-xs)+var(--space-xs))]">
              {isFontAwesomeIcon ? (
                <FontAwesomeIcon icon={item.icon as IconDefinition} className="text-[var(--font-size-base)]" />
              ) : (
                <span className="text-[var(--font-size-base)] leading-none">{item.icon as string}</span>
              )}
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[12px] font-semibold text-[color:var(--color-text)]">
                  {item.value}
                </div>
                <div className="text-[var(--font-size-xs)] uppercase tracking-wider">{item.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )

  if (href) {
    return (
      <Link to={href} state={{ from: '/lobby' }} className={className} style={cardStyle}>
        {content}
      </Link>
    )
  }

  return <div className={className} style={cardStyle}>{content}</div>
}

export default TableSummary
