import { type ReactNode } from 'react'

interface LobbyEmptyStateProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function LobbyEmptyState({ title, description, action }: LobbyEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-[var(--space-md)] rounded-[var(--radius-xl)] border border-dashed border-[color:var(--color-border)] px-[var(--space-lg)] py-[var(--space-xl)] text-center text-[var(--font-size-base)] text-[color:var(--color-text-muted)]">
      <div className="space-y-[var(--space-xs)]">
        <p className="text-[color:var(--color-text)]">{title}</p>
        {description && <p className="text-[var(--font-size-sm)] text-[color:var(--color-text-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export default LobbyEmptyState
