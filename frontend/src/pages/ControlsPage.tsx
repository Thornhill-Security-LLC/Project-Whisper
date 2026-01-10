import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";
import { useSession } from "../context/SessionContext";
import { fetchJson, getApiErrorMessage } from "../lib/api";

type Control = {
  control_id: string;
  title: string;
  status: string;
  framework?: string | null;
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

export function ControlsPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [controls, setControls] = useState<Control[]>([]);
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

    fetchJson<Control[]>(`/api/organisations/${session.orgId}/controls`, {}, {
      orgId: session.orgId,
      actorUserId: session.actorUserId,
      actorEmail: session.actorEmail,
      authToken: session.authToken,
    })
      .then((data) => {
        if (isActive) {
          setControls(data);
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
    const total = controls.length;
    const frameworkSet = new Set(
      controls
        .map((control) => control.framework)
        .filter((framework): framework is string => Boolean(framework))
    );
    const latest = controls
      .map((control) => control.updated_at ?? control.created_at)
      .filter(Boolean)
      .sort()
      .pop();

    return {
      total,
      frameworks: frameworkSet.size,
      latestUpdate: formatTimestamp(latest),
    };
  }, [controls]);

  const rows = controls.map((control) => [
    control.control_id,
    control.title || "Untitled control",
    control.status || "-",
    control.framework || "-",
  ]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total controls" value={stats.total.toString()} trend="Fetched live" />
        <StatCard label="Frameworks" value={stats.frameworks.toString()} trend="Mapped" />
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
            Loading controls...
          </div>
        ) : rows.length > 0 ? (
          <Table columns={["ID", "Title", "Status", "Framework"]} rows={rows} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            No controls found for this organisation yet.
          </div>
        )}
      </section>
    </div>
  );
}
