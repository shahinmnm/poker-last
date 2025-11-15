import { type ReactNode } from 'react'

import { cn } from '../../utils/cn'

interface SectionHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)] sm:text-xl">{title}</h2>
        {subtitle && (
          <p className="text-sm text-[color:var(--text-muted)] sm:text-base">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export default SectionHeader
