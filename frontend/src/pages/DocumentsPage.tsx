import { Table } from "../components/Table";

const documentRows = [
  ["Security policy", "Policy", "Updated", "Mar 15"],
  ["Vendor SOC2", "Evidence", "Uploaded", "Mar 02"],
  ["Access review", "Audit", "In review", "Feb 20"],
];

export function DocumentsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Document repository</h2>
        <p className="mt-2 text-sm text-slate-500">Centralized evidence and audit-ready files.</p>
      </section>
      <Table columns={["Document", "Category", "Status", "Updated"]} rows={documentRows} />
    </div>
  );
}
