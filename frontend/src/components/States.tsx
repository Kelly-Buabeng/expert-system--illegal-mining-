import type { ReactNode } from "react";
import type { ApiError } from "../api/client";
import { Button } from "./ui/Button";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="progress-line" aria-hidden="true" />
      <p className="t-meta">{label}</p>
    </div>
  );
}

/** Placeholder lines shaped like the content that is loading. */
export function Skeleton({ lines = 3, label }: { lines?: number; label: string }) {
  return (
    <div className="skeleton" role="status" aria-live="polite">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className="skeleton__line" aria-hidden="true" />
      ))}
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
  const unreachable = error.status === 0;
  return (
    <div className="state state--error" role="alert">
      <h2 className="t-heading">{title}</h2>
      <p className="t-muted">{error.message}</p>
      {unreachable && (
        <p className="t-meta">
          Your readings and past assessments are safe. Check that the server is running, then try
          again.
        </p>
      )}
      <div className="state__actions">
        {onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
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
      <h2 className="t-heading">{title}</h2>
      <div className="t-muted state__body">{children}</div>
      {action && <div className="state__actions">{action}</div>}
    </div>
  );
}
