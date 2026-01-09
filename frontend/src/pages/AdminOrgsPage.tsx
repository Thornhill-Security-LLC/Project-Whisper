import { Table } from "../components/Table";

const orgRows = [
  ["Acme Security", "Active", "124 users", "Apr 01"],
  ["Lighthouse Labs", "Trial", "32 users", "Mar 26"],
  ["Northwind", "Suspended", "18 users", "Mar 10"],
];

export function AdminOrgsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Organisation management</h2>
        <p className="mt-2 text-sm text-slate-500">
          Admin view for provisioning organisations, plans, and usage details.
        </p>
      </section>
      <Table columns={["Organisation", "Status", "Users", "Last active"]} rows={orgRows} />
    </div>
  );
}
