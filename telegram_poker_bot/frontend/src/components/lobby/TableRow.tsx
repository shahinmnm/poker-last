import { Link } from 'react-router-dom'
import { cn } from '../../utils/cn'
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
}: TableRowProps) {
  return (
    <Link
      to={to}
      state={{ from: '/lobby' }}
      className={cn(
        'block rounded-2xl border border-[color:var(--surface-border)] bg-[color:var(--surface-overlay)]/80 p-4 shadow-sm transition hover:-translate-y-[1px] hover:border-[color:var(--accent-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--accent-start)]',
        muted && 'opacity-70',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-base font-semibold leading-tight text-[color:var(--text-primary)]">
                  {tableName}
                </h3>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-primary)]',
                    'bg-[color:var(--surface-base)]/80 border border-[color:var(--surface-border)]',
                  )}
                >
                  {chipLabel}
                </span>
              </div>
              {subtext && (
                <p className="truncate text-xs text-[color:var(--text-muted)]">{subtext}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                    toneClassMap[statusBadge.tone],
                  )}
                >
                  {statusBadge.label}
                </span>
                {badges.map((badge) => (
                  <span
                    key={`${badge.label}-${badge.tone}`}
                    className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                      toneClassMap[badge.tone],
                    )}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              {actionLabel}
              <span aria-hidden>›</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm text-[color:var(--text-muted)] sm:grid-cols-3">
        {meta.map((item) => (
          <div key={`${item.label}-${item.value}`} className="flex items-center gap-2">
            <span className="text-base leading-none">{item.icon}</span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-semibold text-[color:var(--text-primary)]">
                {item.value}
              </div>
              <div className="text-[11px] uppercase tracking-[0.16em]">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </Link>
  )
}

export default TableRow
