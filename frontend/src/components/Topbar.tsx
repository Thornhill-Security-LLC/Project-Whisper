import type { ReactNode } from "react";

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-6 py-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Project Whisper</p>
        <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <div className="flex items-center gap-3 rounded-full border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Alex Johnson</span>
        </div>
      </div>
    </header>
  );
}
