import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiJson, type ApiAuthContext } from "../lib/api";

const STORAGE_KEY = "opgrc.auth.identity";

type AuthStatus = "checking" | "ready" | "needs-input" | "error";

interface AuthIdentity extends ApiAuthContext {
  authMode?: string | null;
}

interface WhoAmIResponse {
  organisation_id?: string | null;
  user_id?: string | null;
  email?: string | null;
  auth_mode?: string | null;
}

interface AuthContextValue {
  identity: AuthIdentity | null;
  status: AuthStatus;
  headers: Record<string, string>;
  setManualIdentity: (identity: AuthIdentity) => void;
  clearManualIdentity: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredIdentity(): AuthIdentity | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthIdentity>;
    if (!parsed.organisationId || !parsed.userId) {
      return null;
    }
    return {
      organisationId: parsed.organisationId,
      userId: parsed.userId,
      email: parsed.email ?? null,
      authMode: parsed.authMode ?? "dev",
    };
  } catch {
    return null;
  }
}

function buildHeaderMap(identity: AuthIdentity | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!identity) {
    return headers;
  }
  if (identity.organisationId) {
    headers["X-Organisation-Id"] = identity.organisationId;
  }
  if (identity.userId) {
    headers["X-Actor-User-Id"] = identity.userId;
  }
  if (identity.email) {
    headers["X-Actor-Email"] = identity.email;
  }
  return headers;
}

function normalizeWhoami(data: WhoAmIResponse): AuthIdentity {
  return {
    organisationId: data.organisation_id ?? null,
    userId: data.user_id ?? null,
    email: data.email ?? null,
    authMode: data.auth_mode ?? "dev",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<AuthIdentity | null>(() => loadStoredIdentity());
  const [status, setStatus] = useState<AuthStatus>("checking");

  const refresh = async () => {
    setStatus("checking");
    const stored = loadStoredIdentity();

    try {
      const response = await apiJson<WhoAmIResponse>("/api/auth/whoami", {
        auth: stored ?? undefined,
      });
      const resolved = normalizeWhoami(response);
      const merged: AuthIdentity = {
        organisationId: resolved.organisationId ?? stored?.organisationId ?? null,
        userId: resolved.userId ?? stored?.userId ?? null,
        email: resolved.email ?? stored?.email ?? null,
        authMode: resolved.authMode ?? stored?.authMode ?? "dev",
      };

      if (merged.organisationId && merged.userId) {
        setIdentity(merged);
        setStatus("ready");
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        setIdentity(stored ?? merged);
        setStatus("needs-input");
      }
    } catch {
      if (stored) {
        setIdentity(stored);
        setStatus("ready");
      } else {
        setIdentity(null);
        setStatus("needs-input");
      }
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const setManualIdentity = (nextIdentity: AuthIdentity) => {
    const trimmedIdentity = {
      organisationId: nextIdentity.organisationId?.trim() ?? "",
      userId: nextIdentity.userId?.trim() ?? "",
      email: nextIdentity.email?.trim() || null,
      authMode: nextIdentity.authMode ?? "dev",
    };

    const resolved: AuthIdentity = {
      organisationId: trimmedIdentity.organisationId || null,
      userId: trimmedIdentity.userId || null,
      email: trimmedIdentity.email,
      authMode: trimmedIdentity.authMode,
    };

    setIdentity(resolved);
    setStatus(resolved.organisationId && resolved.userId ? "ready" : "needs-input");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
    }
  };

  const clearManualIdentity = () => {
    setIdentity(null);
    setStatus("needs-input");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  const headers = useMemo(() => buildHeaderMap(identity), [identity]);

  const value = useMemo(
    () => ({ identity, status, headers, setManualIdentity, clearManualIdentity, refresh }),
    [identity, status, headers]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
