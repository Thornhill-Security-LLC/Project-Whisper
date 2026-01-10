import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";
import { useSession } from "../context/SessionContext";
import { fetchJson, getApiErrorMessage } from "../lib/api";

type Risk = {
  risk_id: string;
  title: string;
  status: string;
  created_at?: string;
  updated_at?: string;
};

function formatTimestamp(value?: string) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function RisksPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.orgId) {
      navigate("/login", { replace: true });
    }
  }, [navigate, session?.orgId]);

  useEffect(() => {
    if (!session?.orgId) {
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    fetchJson<Risk[]>(`/api/organisations/${session.orgId}/risks`, {}, {
      orgId: session.orgId,
      actorUserId: session.actorUserId,
      actorEmail: session.actorEmail,
      authToken: session.authToken,
    })
      .then((data) => {
        if (isActive) {
          setRisks(data);
        }
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(getApiErrorMessage(fetchError));
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [session?.orgId, session?.actorUserId, session?.actorEmail, session?.authToken]);

  const stats = useMemo(() => {
    const total = risks.length;
    const statusSet = new Set(risks.map((risk) => risk.status).filter(Boolean));
    const latest = risks
      .map((risk) => risk.updated_at ?? risk.created_at)
      .filter(Boolean)
      .sort()
      .pop();

    return {
      total,
      statusCount: statusSet.size,
      latestUpdate: formatTimestamp(latest),
    };
  }, [risks]);

  const rows = risks.map((risk) => [
    risk.risk_id,
    risk.title || "Untitled risk",
    risk.status || "-",
    formatTimestamp(risk.updated_at ?? risk.created_at),
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total risks" value={stats.total.toString()} trend="Fetched live" />
        <StatCard
          label="Distinct statuses"
          value={stats.statusCount.toString()}
          trend="Live mix"
        />
        <StatCard label="Latest update" value={stats.latestUpdate} trend="Most recent" />
      </section>

      <section className="space-y-3">
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            Loading risks...
          </div>
        ) : rows.length > 0 ? (
          <Table columns={["ID", "Title", "Status", "Updated"]} rows={rows} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            No risks found for this organisation yet.
          </div>
        )}
      </section>
    </div>
  );
}
