import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { useSession } from "../context/SessionContext";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppLayout({ title, subtitle, actions, children }: AppLayoutProps) {
  const { status } = useSession();

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        {status === "invalid" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-900/60 bg-rose-950 px-6 py-3 text-sm text-rose-100">
            <span>Session invalid. Please return to login to bootstrap a new session.</span>
            <Link
              className="rounded-full border border-rose-200/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100"
              to="/login"
            >
              Go to login
            </Link>
          </div>
        ) : null}
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 space-y-6 bg-slate-950 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
