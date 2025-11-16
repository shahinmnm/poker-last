import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { cn } from '../../utils/cn'
import { getTimeRemaining } from '../../utils/countdown'
import type { TableStatusTone } from './types'

interface MetaItem {
  icon: string
  label: string
  value: string
}

type BadgeTone = TableStatusTone | 'host' | 'seated' | 'visibility'

interface BadgeDescriptor {
  label: string
  tone: BadgeTone
}

export interface TableRowProps {
  to: string
  tableName: string
  chipLabel: string
  statusBadge: BadgeDescriptor
  meta: MetaItem[]
  badges?: BadgeDescriptor[]
  muted?: boolean
  subtext?: string | null
  actionLabel?: string
  expiresAt?: string | null
}

const toneClassMap: Record<BadgeTone, string> = {
  running: 'bg-[color:var(--status-running-bg)] text-[color:var(--status-running-text)]',
  waiting: 'bg-[color:var(--status-waiting-bg)] text-[color:var(--status-waiting-text)]',
  finished: 'bg-[color:var(--status-finished-bg)] text-[color:var(--status-finished-text)]',
  host: 'bg-[color:var(--role-host-bg)] text-[color:var(--role-host-text)]',
  seated: 'bg-[color:var(--role-seated-bg)] text-[color:var(--role-seated-text)]',
  visibility: 'bg-[color:var(--surface-border)]/40 text-[color:var(--text-primary)]',
}

export function TableRow({
  to,
  tableName,
  chipLabel,
  statusBadge,
  meta,
  badges = [],
  muted,
  subtext,
  actionLabel = 'Open',
  expiresAt,
}: TableRowProps) {
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

  return (
    <Link
      to={to}
      state={{ from: '/lobby' }}
      className={cn(
        'block rounded-xl border p-3 shadow-sm transition hover:-translate-y-[1px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-start)]',
        isExpiringSoon
          ? 'border-[color:var(--danger-glass-border)] bg-[color:var(--danger-glass)] hover:border-[color:var(--danger)]'
          : 'border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)]/80 hover:border-[color:var(--accent-soft)]',
        muted && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-semibold leading-tight text-[color:var(--text-primary)]">
                  {tableName}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-primary)]',
                    'bg-[color:var(--surface-base)]/80 border border-[color:var(--surface-border)]',
                  )}
                >
                  {chipLabel}
                </span>
              </div>
              {subtext && (
                <p className="truncate text-[11px] text-[color:var(--text-muted)]">{subtext}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
              {actionLabel}
              <span aria-hidden>›</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                toneClassMap[statusBadge.tone],
              )}
            >
              {statusBadge.label}
            </span>
            {badges.map((badge) => (
              <span
                key={`${badge.label}-${badge.tone}`}
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                  toneClassMap[badge.tone],
                )}
              >
                {badge.label}
              </span>
            ))}
            {expiresAt && !timeRemaining.isExpired && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold',
                  isExpiringSoon
                    ? 'bg-[color:var(--danger)] text-white'
                    : 'bg-[color:var(--surface-base)]/60 text-[color:var(--text-muted)]',
                )}
              >
                ⏱ {timeRemaining.minutes}:{String(timeRemaining.seconds).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-[color:var(--text-muted)] sm:grid-cols-3">
        {meta.map((item) => (
          <div key={`${item.label}-${item.value}`} className="flex items-center gap-1.5">
            <span className="text-sm leading-none">{item.icon}</span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[12px] font-semibold text-[color:var(--text-primary)]">
                {item.value}
              </div>
              <div className="text-[10px] uppercase tracking-wider">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </Link>
  )
}

export default TableRow
