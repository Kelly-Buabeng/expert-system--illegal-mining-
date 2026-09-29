import type {
  Assessment,
  AssessmentSummary,
  KnowledgeBase,
  ListQuery,
  NewAssessment,
  Page,
} from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error", "Could not reach the server. Check your connection.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: Partial<ApiError> } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "http_error",
      error?.message ?? `The server responded with ${response.status}.`,
      error?.fields ?? {},
    );
  }
  return body as T;
}

export const api = {
  knowledgeBase: (signal?: AbortSignal) => request<KnowledgeBase>("/knowledge-base", { signal }),

  communities: (signal?: AbortSignal) =>
    request<{ items: string[] }>("/communities", { signal }).then((data) => data.items),

  listAssessments: (query: ListQuery, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.risk) params.set("risk", query.risk);
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    if (query.offset) params.set("offset", String(query.offset));
    const search = params.toString();
    return request<Page<AssessmentSummary>>(`/assessments${search ? `?${search}` : ""}`, {
      signal,
    });
  },

  getAssessment: (id: number, signal?: AbortSignal) =>
    request<Assessment>(`/assessments/${id}`, { signal }),

  createAssessment: (input: NewAssessment) =>
    request<Assessment>("/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
};
