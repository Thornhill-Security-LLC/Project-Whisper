import { Table } from "../components/Table";

const accessRows = [
  ["Alex Johnson", "Admin", "Org owner", "2 hours ago"],
  ["Sofia Patel", "Access review", "Viewer", "Yesterday"],
  ["Kai Chen", "Control update", "Editor", "Mar 28"],
];

export function AccessPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Access & RBAC log</h2>
        <p className="mt-2 text-sm text-slate-500">
          Audit administrative actions, permissions, and role changes.
        </p>
      </section>
      <Table columns={["Actor", "Action", "Role", "Timestamp"]} rows={accessRows} />
    </div>
  );
}
