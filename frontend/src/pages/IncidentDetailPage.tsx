import { useParams } from "react-router-dom";
import { Table } from "../components/Table";

export function IncidentDetailPage() {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-wide text-slate-400">Incident {id}</p>
        <h2 className="text-2xl font-semibold text-slate-900">Credential compromise investigation</h2>
        <p className="mt-2 text-sm text-slate-500">
          Timeline, root cause analysis, and response actions will be shown here.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Investigating</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Priority: High</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">Owner: Kai Chen</span>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Incident narrative</h3>
          <p className="mt-3 text-sm text-slate-600">
            Include the narrative, systems impacted, and containment progress. This shell mirrors the UXpilot
            detail panel layout.
          </p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>• 09:18 UTC — Alert triggered via SOC monitoring.</p>
            <p>• 09:45 UTC — User account disabled and password reset enforced.</p>
            <p>• 10:15 UTC — Forensic review initiated.</p>
          </div>
        </div>
        <Table
          columns={["Task", "Owner", "Status"]}
          rows={[
            ["Collect logs", "Security", "In progress"],
            ["Notify stakeholders", "Ops", "Pending"],
            ["Post-mortem", "Risk", "Planned"],
          ]}
        />
      </section>
    </div>
  );
}
