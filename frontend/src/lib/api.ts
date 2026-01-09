const DEFAULT_BASE_URL = "http://localhost:8000";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL;

export type BackendStatus = "unknown" | "ok" | "down";

export async function fetchHealth(): Promise<BackendStatus> {
  try {
    const response = await fetch(`${apiBaseUrl}/health`);
    if (!response.ok) {
      return "down";
    }
    return "ok";
  } catch {
    return "down";
  }
}

export async function fetchWhoAmI() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/whoami`);
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}
