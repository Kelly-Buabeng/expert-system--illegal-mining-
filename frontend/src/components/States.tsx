import type { ReactNode } from "react";
import type { ApiError } from "../api/client";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  error: ApiError;
  onRetry?: () => void;
  children?: ReactNode;
}

export function ErrorState({ title, error, onRetry, children }: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <h2 className="state__title">{title}</h2>
      <p>{error.message}</p>
      <div className="state__actions">
        {onRetry && (
          <button type="button" className="button button--secondary" onClick={onRetry}>
            Try again
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="state">
      <h2 className="state__title">{title}</h2>
      <p>{children}</p>
      {action && <div className="state__actions">{action}</div>}
    </div>
  );
}
