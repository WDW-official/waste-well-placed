export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <span className={`admin-skeleton-block ${className}`} aria-hidden="true" />
  );
}

export function TableRowsSkeleton({
  columns,
  rows = 6,
}: {
  columns: number;
  rows?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <td key={column}>
              <SkeletonBlock
                className={
                  column === 0 ? "skeleton-line-long" : "skeleton-line"
                }
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminSkeleton({
  variant = "cards",
  label = "Loading records",
}: {
  variant?: "page" | "cards" | "metrics" | "form" | "details";
  label?: string;
}) {
  return (
    <div
      className={`admin-skeleton admin-skeleton-${variant}`}
      role="status"
      aria-label={label}
    >
      <span className="sr-only">{label}…</span>
      <div aria-hidden="true">
        {variant === "page" && (
          <div className="skeleton-page-heading">
            <SkeletonBlock className="skeleton-eyebrow" />
            <SkeletonBlock className="skeleton-title" />
          </div>
        )}
        {variant === "metrics" || variant === "page" ? (
          <div className="skeleton-metrics-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="skeleton-surface" key={index}>
                <SkeletonBlock className="skeleton-line-long" />
                <SkeletonBlock className="skeleton-number" />
                <SkeletonBlock className="skeleton-line" />
              </div>
            ))}
          </div>
        ) : null}
        {variant === "cards" && (
          <div className="skeleton-cards-grid">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="skeleton-surface" key={index}>
                <SkeletonBlock className="skeleton-title" />
                <SkeletonBlock className="skeleton-line" />
                <SkeletonBlock className="skeleton-line-long" />
                <SkeletonBlock className="skeleton-button" />
              </div>
            ))}
          </div>
        )}
        {variant === "form" || variant === "details" ? (
          <div className="skeleton-surface">
            <SkeletonBlock className="skeleton-title" />
            <div className="skeleton-form-grid">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index}>
                  <SkeletonBlock className="skeleton-line" />
                  <SkeletonBlock className="skeleton-input" />
                </div>
              ))}
            </div>
            <SkeletonBlock className="skeleton-button" />
          </div>
        ) : null}
        {variant === "page" && (
          <div className="skeleton-surface skeleton-page-table">
            <SkeletonBlock className="skeleton-input" />
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonBlock key={index} className="skeleton-table-line" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
