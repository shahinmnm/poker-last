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
    <div className="lobby-empty">
      <h3 className="lobby-empty__title ui-nowrap" dir="auto">{title}</h3>
      {description && (
        <p className="lobby-empty__desc ui-nowrap" dir="auto">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="lobby-empty__actions">
          <button
            type="button"
            onClick={onAction}
            disabled={actionDisabled}
            className="lobby-empty__cta"
          >
            <span className="ui-nowrap">{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  )
}
