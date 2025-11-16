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
    <header className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && <span className="text-2xl">{icon}</span>}
          <h1 className="text-page-title text-[color:var(--text-primary)]">{title}</h1>
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
      {subtitle && (
        <p className="text-caption text-[color:var(--text-muted)]">{subtitle}</p>
      )}
    </header>
  )
}

export default PageHeader
