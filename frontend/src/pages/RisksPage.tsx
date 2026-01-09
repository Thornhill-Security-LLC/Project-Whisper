import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";

const riskRows = [
  ["Credential stuffing", "High", "Open", "Emma Lewis"],
  ["Vendor uptime", "Medium", "Monitoring", "Kai Chen"],
  ["Legacy access", "High", "Mitigating", "Sofia Patel"],
];

export function RisksPage() {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Open risks" value="24" trend="+3 this month" />
        <StatCard label="Mitigating" value="8" trend="On track" />
        <StatCard label="Accepted" value="5" trend="2 awaiting review" />
      </section>

      <section>
        <Table columns={["Risk", "Severity", "Status", "Owner"]} rows={riskRows} />
      </section>

      <Modal
        open={false}
        title="New risk"
        description="This modal is a placeholder for the upcoming create-risk flow."
      />
    </div>
  );
}
