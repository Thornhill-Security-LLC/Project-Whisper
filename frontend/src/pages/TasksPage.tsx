import { Table } from "../components/Table";

const taskRows = [
  ["Collect vendor evidence", "Kai Chen", "Due Apr 12", "Open"],
  ["Review access log", "Sofia Patel", "Due Apr 14", "In progress"],
  ["Finalize risk memo", "Emma Lewis", "Due Apr 18", "Planned"],
];

export function TasksPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Task tracker</h2>
        <p className="mt-2 text-sm text-slate-500">Prioritize and manage compliance work items.</p>
      </section>
      <Table columns={["Task", "Owner", "Due", "Status"]} rows={taskRows} />
    </div>
  );
}
