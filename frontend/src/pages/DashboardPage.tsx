import { useEffect, useState } from "react";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";
import { fetchHealth, type BackendStatus } from "../lib/api";

const activityRows = [
  ["New vendor intake", "Third-party", "In review", "2 hours ago"],
  ["SOC2 evidence upload", "Document", "Completed", "Yesterday"],
  ["Incident triage", "Security", "Open", "2 days ago"],
];

export function DashboardPage() {
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("unknown");

  useEffect(() => {
    let isActive = true;
    fetchHealth().then((status) => {
      if (isActive) {
        setBackendStatus(status);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  const statusStyles = {
    unknown: "bg-slate-100 text-slate-600",
    ok: "bg-emerald-100 text-emerald-700",
    down: "bg-rose-100 text-rose-700",
  } satisfies Record<BackendStatus, string>;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <p className="text-sm text-slate-500">Overview</p>
          <h2 className="text-xl font-semibold text-slate-900">Risk posture snapshot</h2>
          <p className="mt-1 text-sm text-slate-500">
            Summary cards mirror the UXpilot dashboard composition.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[backendStatus]}`}>
          Backend status: {backendStatus}
        </span>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Open risks" value="24" trend="+4 this week" />
        <StatCard label="Controls in progress" value="18" trend="2 awaiting review" />
        <StatCard label="Vendors monitored" value="12" trend="On track" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Table
          columns={["Activity", "Type", "Status", "Updated"]}
          rows={activityRows}
        />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Upcoming tasks</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex items-center justify-between">
              <span>Review vendor SOC reports</span>
              <span className="text-xs text-slate-400">Tomorrow</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Finalize Q3 incident drill</span>
              <span className="text-xs text-slate-400">Friday</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Access review for HR</span>
              <span className="text-xs text-slate-400">Next week</span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
