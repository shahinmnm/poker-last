export default function SkeletonRow() {
  return (
    <div className="table-card-v2 table-card-v2--skeleton animate-pulse" aria-hidden="true">
      <div className="table-card-v2__occupancy">
        <div className="table-card-v2__occupancy-ring table-card-v2__occupancy-ring--skeleton" />
      </div>
      <div className="table-card-v2__content">
        <div className="table-card-v2__skeleton-row">
          <span className="table-card-v2__skeleton-line is-wide" />
          <span className="table-card-v2__skeleton-chip is-short" />
        </div>
        <div className="table-card-v2__skeleton-row">
          <span className="table-card-v2__skeleton-line is-medium" />
          <span className="table-card-v2__skeleton-line is-short" />
        </div>
      </div>
      <div className="table-card-v2__actions">
        <span className="table-card-v2__skeleton-icon" />
        <span className="table-card-v2__skeleton-button" />
      </div>
    </div>
  )
}
