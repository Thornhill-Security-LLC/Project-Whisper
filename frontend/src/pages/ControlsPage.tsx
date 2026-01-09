import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";

const controlRows = [
  ["CC6.1 Logical access", "SOC2", "Implemented", "Security"],
  ["CC7.2 Monitoring", "SOC2", "In progress", "IT"],
  ["A.12.4 Logging", "ISO27001", "Planned", "Compliance"],
];

export function ControlsPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Implemented" value="42" trend="+6 this quarter" />
        <StatCard label="In progress" value="18" trend="5 awaiting approval" />
        <StatCard label="Planned" value="11" trend="Review next" />
      </section>

      <section>
        <Table columns={["Control", "Framework", "Status", "Owner"]} rows={controlRows} />
      </section>
    </div>
  );
}
