const DEFAULT_BASE_URL = "http://localhost:8000";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;

export type BackendStatus = "unknown" | "ok" | "down";

export interface ApiSession {
  orgId?: string;
  actorUserId?: string;
  actorEmail?: string;
  authToken?: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Not authenticated";
    }
    if (error.status === 403) {
      return "Insufficient permissions";
    }
    if (error.status === 404) {
      return "Not found";
    }
  }
  return "Unexpected error";
}

export function buildHeaders(options?: RequestInit, session?: ApiSession): Headers {
  const headers = new Headers(options?.headers ?? undefined);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (session?.orgId) {
    headers.set("X-Organisation-Id", session.orgId);
  }
  if (session?.actorUserId) {
    headers.set("X-Actor-User-Id", session.actorUserId);
  }
  if (session?.actorEmail) {
    headers.set("X-Actor-Email", session.actorEmail);
  }
  if (session?.authToken) {
    headers.set("Authorization", `Bearer ${session.authToken}`);
  }

  return headers;
}

export async function fetchJson<T>(
  path: string,
  options: RequestInit = {},
  session?: ApiSession
): Promise<T> {
  const headers = buildHeaders(options, session);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText || "Request failed");
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchHealth(): Promise<BackendStatus> {
  try {
    await fetchJson("/health");
    return "ok";
  } catch {
    return "down";
  }
}
