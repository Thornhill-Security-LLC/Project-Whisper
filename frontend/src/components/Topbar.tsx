import type { ReactNode } from "react";
import { useSession } from "../context/SessionContext";

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

const statusStyles: Record<string, string> = {
  idle: "bg-slate-500",
  checking: "bg-amber-400",
  valid: "bg-emerald-400",
  invalid: "bg-rose-400",
};

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { session, status } = useSession();
  const authMode = session?.authMode ?? "dev";
  const orgShort = session?.orgId ? session.orgId.slice(0, 8) : "—";
  const actorShort = session?.actorUserId ? session.actorUserId.slice(0, 8) : "—";

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
