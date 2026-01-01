export default function SkeletonRow() {
  return (
    <div
      className="table-card table-card--skeleton animate-pulse"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3 w-28 rounded-full bg-[var(--surface-3)]" />
            <div className="h-3 w-16 rounded-full bg-[var(--surface-3)]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-4 w-20 rounded-full bg-[var(--surface-3)]" />
            <div className="h-3 w-24 rounded-full bg-[var(--surface-3)]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-20 rounded-full bg-[var(--surface-3)]" />
            <div className="h-3 w-16 rounded-full bg-[var(--surface-3)]" />
            <div className="h-3 w-14 rounded-full bg-[var(--surface-3)]" />
          </div>
        </div>
        <div className="h-8 w-8 rounded-full bg-[var(--surface-3)]" />
      </div>
    </div>
  )
}
