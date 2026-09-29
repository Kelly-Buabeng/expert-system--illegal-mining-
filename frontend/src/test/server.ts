import { vi } from "vitest";

type Handler = (request: { url: URL; method: string; body: unknown }) => {
  status?: number;
  body: unknown;
};

/**
 * Replaces fetch with a router keyed by "METHOD /path". Unmatched requests fail the
 * test loudly. Returns the list of requests made, for assertions.
 */
export function mockApi(routes: Record<string, Handler | { status?: number; body: unknown }>) {
  const requests: { method: string; url: URL; body: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, url, body });
    const route = routes[`${method} ${url.pathname}`];
    if (!route) throw new Error(`Unexpected request ${method} ${url.pathname}`);
    const result = typeof route === "function" ? route({ url, method, body }) : route;
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  return requests;
}
