import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchJson } from "../lib/api";

const STORAGE_KEY = "opgrc.session";

export type AuthMode = "dev" | "oidc";

export interface Session {
  orgId: string;
  actorUserId: string;
  actorEmail?: string;
  authMode?: AuthMode;
  authToken?: string;
}

type SessionStatus = "idle" | "checking" | "valid" | "invalid";

interface SessionContextValue {
  session: Session | null;
  status: SessionStatus;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function loadStoredSession(): Session | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.orgId !== "string" || typeof parsed.actorUserId !== "string") {
      return null;
    }
    return {
      orgId: parsed.orgId,
      actorUserId: parsed.actorUserId,
      actorEmail: parsed.actorEmail,
      authMode: parsed.authMode ?? "dev",
      authToken: parsed.authToken,
    };
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => loadStoredSession());
  const [status, setStatus] = useState<SessionStatus>(() =>
    session ? "checking" : "idle"
  );

  const setSession = (nextSession: Session) => {
    const storedSession = {
      ...nextSession,
      authMode: nextSession.authMode ?? "dev",
    };
    setSessionState(storedSession);
    setStatus("checking");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSession));
    }
  };

  const clearSession = () => {
    setSessionState(null);
    setStatus("idle");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    if (!session) {
      return;
    }

    let isActive = true;
    setStatus("checking");

    fetchJson("/api/auth/whoami", {}, {
      orgId: session.orgId,
      actorUserId: session.actorUserId,
      actorEmail: session.actorEmail,
      authToken: session.authToken,
    })
      .then(() => {
        if (isActive) {
          setStatus("valid");
        }
      })
      .catch(() => {
        if (isActive) {
          setStatus("invalid");
        }
      });

    return () => {
      isActive = false;
    };
  }, [session?.orgId, session?.actorUserId, session?.actorEmail, session?.authToken]);

  const value = useMemo(
    () => ({ session, status, setSession, clearSession }),
    [session, status]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
