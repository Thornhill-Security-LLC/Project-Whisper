import { Table } from "../components/Table";

const vendorRows = [
  ["CloudEdge", "Critical", "Annual review", "Apr 12"],
  ["Payrollly", "High", "Pending", "May 01"],
  ["NotionHub", "Medium", "Completed", "Mar 30"],
];

export function VendorsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Vendor lifecycle</h2>
        <p className="mt-2 text-sm text-slate-500">
          Track due diligence, questionnaires, and contract milestones.
        </p>
      </section>
      <Table columns={["Vendor", "Criticality", "Status", "Next review"]} rows={vendorRows} />
    </div>
  );
}
