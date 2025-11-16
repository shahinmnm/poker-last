import { type ReactNode } from 'react'

interface LobbyEmptyStateProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function LobbyEmptyState({ title, description, action }: LobbyEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[color:var(--surface-border)] px-4 py-6 text-center text-sm text-[color:var(--text-muted)]">
      <div className="space-y-1">
        <p className="text-[color:var(--text-primary)]">{title}</p>
        {description && <p className="text-xs text-[color:var(--text-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export default LobbyEmptyState
