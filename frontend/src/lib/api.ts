const DEFAULT_BASE_URL = "http://localhost:8000";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;

export type BackendStatus = "unknown" | "ok" | "down";

export interface ApiAuthContext {
  organisationId?: string | null;
  userId?: string | null;
  email?: string | null;
  authToken?: string | null;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `(${error.status}): ${error.message}`;
  }
  return "Unexpected error";
}

export function buildHeaders(options?: RequestInit, auth?: ApiAuthContext): Headers {
  const headers = new Headers(options?.headers ?? undefined);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (auth?.organisationId && !headers.has("X-Organisation-Id")) {
    headers.set("X-Organisation-Id", auth.organisationId);
  }
  if (auth?.userId && !headers.has("X-Actor-User-Id")) {
    headers.set("X-Actor-User-Id", auth.userId);
  }
  if (auth?.email && !headers.has("X-Actor-Email")) {
    headers.set("X-Actor-Email", auth.email);
  }
  if (auth?.authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${auth.authToken}`);
  }

  return headers;
}

export interface ApiRequestOptions extends RequestInit {
  auth?: ApiAuthContext;
  json?: unknown;
}

async function parseApiError(response: Response): Promise<ApiError> {
  let message = response.statusText || "Request failed";
  let body: unknown = undefined;

  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      body = await response.clone().json();
      if (body && typeof body === "object" && "detail" in body) {
        const detail = (body as { detail?: string }).detail;
        if (detail) {
          message = detail;
        }
      }
    } catch {
      // Ignore parsing errors.
    }
  }

  if (body === undefined) {
    try {
      const text = await response.clone().text();
      if (text) {
        body = text;
        message = text;
      }
    } catch {
      // Ignore parsing errors.
    }
  }

  return new ApiError(response.status, message, body);
}

export async function apiFetch(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { auth, json, ...rest } = options;
  const headers = buildHeaders(rest, auth);

  let body = rest.body;
  if (json !== undefined) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(json);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response;
}

export async function apiJson<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const response = await apiFetch(path, options);

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchHealth(): Promise<BackendStatus> {
  try {
    await apiFetch("/health");
    return "ok";
  } catch {
    return "down";
  }
}

export const fetchJson = apiJson;
