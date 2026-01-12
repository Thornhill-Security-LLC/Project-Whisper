import type { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const statusStyles: Record<string, string> = {
  checking: "bg-amber-400",
  ready: "bg-emerald-400",
  "needs-input": "bg-rose-400",
  error: "bg-rose-400",
};

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { identity, status } = useAuth();
  const authMode = identity?.authMode ?? "dev";
  const orgShort = identity?.organisationId ? identity.organisationId.slice(0, 8) : "—";
  const actorShort = identity?.userId ? identity.userId.slice(0, 8) : "—";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-6 py-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Project Whisper</p>
        <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          <span className={`h-2 w-2 rounded-full ${statusStyles[status]}`} />
          <span className="uppercase text-slate-400">{authMode}</span>
          <span>org:{orgShort}</span>
          <span>actor:{actorShort}</span>
        </div>
      </div>
    </header>
  );
}
