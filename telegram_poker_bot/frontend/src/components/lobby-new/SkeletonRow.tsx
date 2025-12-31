export default function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-2xl border border-[var(--border-3)] bg-[var(--surface-2)] p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="h-3 w-32 rounded-full bg-[var(--surface-3)]" />
          <div className="h-5 w-24 rounded-full bg-[var(--surface-3)]" />
          <div className="h-3 w-48 rounded-full bg-[var(--surface-3)]" />
        </div>
        <div className="h-11 w-24 rounded-full bg-[var(--surface-3)]" />
      </div>
    </div>
  )
}
