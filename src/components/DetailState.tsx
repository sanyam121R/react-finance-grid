/** Built-in loading skeleton for an async expanded panel. */
export function DetailLoading({ rowId }: { rowId: string }) {
    return (
      <div
        className="rfg-detail-loading"
        role="status"
        aria-live="polite"
        aria-label="Loading row details"
        data-testid={`detail-loading-${rowId}`}
      >
        <span className="rfg-skeleton-bar" style={{ width: "40%" }} />
        <span className="rfg-skeleton-bar" style={{ width: "70%" }} />
        <span className="rfg-skeleton-bar" style={{ width: "55%" }} />
      </div>
    );
  }
  
  /** Built-in error state with retry for an async expanded panel. */
  export function DetailError({
    rowId,
    error,
    onRetry,
  }: {
    rowId: string;
    error: unknown;
    onRetry: () => void;
  }) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";
    return (
      <div
        className="rfg-detail-error"
        role="alert"
        data-testid={`detail-error-${rowId}`}
      >
        <div className="rfg-detail-error-text">
          <strong>Could not load details.</strong>
          <span className="rfg-detail-error-message">{message}</span>
        </div>
        <button
          type="button"
          className="rfg-btn"
          data-testid={`detail-retry-${rowId}`}
          onClick={onRetry}
        >
          Retry
        </button>
      </div>
    );
  }