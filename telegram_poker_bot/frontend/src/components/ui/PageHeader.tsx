import { type ReactNode } from 'react'

import { cn } from '../../utils/cn'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  rightAction?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, icon, rightAction, className }: PageHeaderProps) {
  return (
    <header className={cn('space-y-[var(--space-sm)]', className)}>
      <div className="flex items-center justify-between gap-[var(--space-lg)]">
        <div className="flex items-center gap-[var(--space-md)]">
          {icon && <span className="text-[var(--font-size-2xl)]">{icon}</span>}
          <h1 className="text-page-title text-[color:var(--color-text)]">{title}</h1>
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
      {subtitle && (
        <p className="text-caption text-[color:var(--color-text-muted)]">{subtitle}</p>
      )}
    </header>
  )
}

export default PageHeader
