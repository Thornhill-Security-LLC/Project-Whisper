import { Table } from "../components/Table";

const incidentRows = [
  ["INC-1024", "Phishing report", "Open", "2 hours ago"],
  ["INC-1023", "Suspicious login", "Investigating", "Yesterday"],
  ["INC-1022", "Policy exception", "Resolved", "Mar 28"],
];

export function IncidentsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Incident queue</h2>
        <p className="mt-2 text-sm text-slate-500">
          Maintain timelines, assign owners, and ensure follow-up actions.
        </p>
      </section>
      <Table columns={["ID", "Summary", "Status", "Updated"]} rows={incidentRows} />
    </div>
  );
}
