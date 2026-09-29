import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";

interface Result<T> {
  key: string;
  data?: T;
  error?: ApiError;
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, "unexpected_error", "Something went wrong while loading this page.");
}

/**
 * Loads data for `key`, re-running whenever `key` changes and cancelling stale
 * requests. While a new key loads, the previous data stays available so lists
 * do not flash empty between pages.
 */
export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${key}#${attempt}`;
  const [result, setResult] = useState<Result<T>>({ key: "" });
  const loadRef = useRef(load);

  useLayoutEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, error: toApiError(error) });
      },
    );
    return () => controller.abort();
  }, [requestKey]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const loading = result.key !== requestKey;
  return { data: result.data, error: loading ? undefined : result.error, loading, reload };
}
