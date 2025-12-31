import Button from '../ui/Button'

interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-1)] p-6 text-center">
      <h3 className="text-base font-semibold text-[var(--text-1)]" dir="auto">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-sm text-[var(--text-3)]" dir="auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4 flex justify-center">
          <Button size="md" variant="secondary" className="min-h-[44px]" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
