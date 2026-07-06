export type ApiResult<T> =
  | { status: "ok"; data: T }
  | { status: "no_content" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export interface FetchJsonOptions {
  /** Treat HTTP 204 as no_content. */
  noContent?: boolean;
  /** Treat HTTP 404 as not_found. */
  notFound?: boolean;
  /** Extract error message from JSON body `{ error?: string }`. */
  parseErrorBody?: boolean;
}

function networkError(err: unknown): ApiResult<never> {
  return {
    status: "error",
    message: err instanceof Error ? err.message : "Network error",
  };
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {}
): Promise<ApiResult<T>> {
  const { noContent = false, notFound = false, parseErrorBody = false } = options;
  try {
    const res = await fetch(url);
    if (noContent && res.status === 204) return { status: "no_content" };
    if (notFound && res.status === 404) return { status: "not_found" };
    if (!res.ok) {
      if (parseErrorBody) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        return { status: "error", message: body?.error ?? `HTTP ${res.status}` };
      }
      return { status: "error", message: `HTTP ${res.status}` };
    }
    return { status: "ok", data: (await res.json()) as T };
  } catch (err) {
    return networkError(err);
  }
}
