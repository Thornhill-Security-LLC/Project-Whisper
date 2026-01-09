import { Table } from "../components/Table";

const assetRows = [
  ["AWS Production", "Cloud", "Critical", "Owner: Platform"],
  ["Okta", "Identity", "High", "Owner: IT"],
  ["GitHub", "DevOps", "Medium", "Owner: Eng"],
];

export function AssetsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Asset inventory</h2>
        <p className="mt-2 text-sm text-slate-500">Track critical systems and ownership assignments.</p>
      </section>
      <Table columns={["Asset", "Type", "Criticality", "Notes"]} rows={assetRows} />
    </div>
  );
}
