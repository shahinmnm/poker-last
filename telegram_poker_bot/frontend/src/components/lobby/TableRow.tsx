import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import TableSummary, { SummaryBadgeDescriptor } from '../tables/TableSummary'

export interface TableRowProps {
  to: string
  tableName: string
  chipLabel: string
  statusBadge: SummaryBadgeDescriptor
  meta: { icon: string | IconDefinition; label: string; value: string }[]
  badges?: SummaryBadgeDescriptor[]
  muted?: boolean
  subtext?: string | null
  actionLabel?: string
  expiresAt?: string | null
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
  return (
    <TableSummary
      href={to}
      tableName={tableName}
      chipLabel={chipLabel}
      statusBadge={statusBadge}
      meta={meta}
      badges={badges}
      muted={muted}
      subtext={subtext}
      actionLabel={actionLabel}
      expiresAt={expiresAt}
    />
  )
}

export default TableRow
