interface EmptyStateProps {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionDisabled?: boolean
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-[var(--border-2)] bg-[var(--surface-2)] p-5 text-center shadow-[0_12px_24px_rgba(0,0,0,0.2)]">
      <h3 className="text-[15px] font-semibold text-[var(--text-1)]" dir="auto">
        {title}
      </h3>
      {description && (
        <p className="mt-2 text-[12px] text-[var(--text-3)]" dir="auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="group inline-flex min-h-[44px] items-center disabled:cursor-not-allowed"
          >
            <span
              className={`flex h-9 items-center rounded-full border border-[var(--border-2)] bg-[var(--surface-1)] px-4 text-[12px] font-semibold text-[var(--text-1)] transition group-active:scale-[0.97] ${
                actionDisabled ? 'opacity-60' : ''
              }`}
            >
              {actionLabel}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
