import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";
import { useSession } from "../context/SessionContext";
import { getApiErrorMessage } from "../lib/api";
import { createRisk, listRisks, type RiskPayload, type RiskSummary } from "../lib/risks";

type RiskFormState = {
  title: string;
  description: string;
  severity: string;
  likelihood: string;
  impact: string;
  status: string;
};

const emptyForm: RiskFormState = {
  title: "",
  description: "",
  severity: "",
  likelihood: "",
  impact: "",
  status: "",
};

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function buildPayload(form: RiskFormState): RiskPayload {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    severity: form.severity.trim() || null,
    likelihood: form.likelihood.trim() || null,
    impact: form.impact.trim() || null,
    status: form.status.trim() || null,
  };
}

export function RisksPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [risks, setRisks] = useState<RiskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<RiskFormState>(emptyForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.orgId || !session?.actorUserId) {
      navigate("/login", { replace: true });
    }
  }, [navigate, session?.orgId, session?.actorUserId]);

  useEffect(() => {
    if (!session?.orgId || !session?.actorUserId) {
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    listRisks(session.orgId, session)
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
      latestUpdate: formatTimestamp(latest ?? null),
    };
  }, [risks]);

  const rows = risks.map((risk) => [
    <Link
      key={risk.risk_id}
      className="text-sm font-semibold text-sky-600 hover:text-sky-500"
      to={`/risks/${risk.risk_id}`}
    >
      {risk.risk_id}
    </Link>,
    <Link
      key={`${risk.risk_id}-title`}
      className="text-slate-700 hover:text-slate-900"
      to={`/risks/${risk.risk_id}`}
    >
      {risk.title || "Untitled risk"}
    </Link>,
    risk.status || "-",
    formatTimestamp(risk.updated_at ?? risk.created_at ?? null),
  ]);

  const handleOpenModal = () => {
    setCreateError(null);
    setFormState(emptyForm);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!createLoading) {
      setModalOpen(false);
    }
  };

  const handleFormChange = (field: keyof RiskFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    if (!session?.orgId || !session?.actorUserId) {
      navigate("/login", { replace: true });
      return;
    }

    if (!formState.title.trim()) {
      setCreateError("Title is required.");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      const created = await createRisk(session.orgId, buildPayload(formState), session);
      setModalOpen(false);
      setFormState(emptyForm);
      navigate(`/risks/${created.risk_id}`);
    } catch (createErr) {
      setCreateError(getApiErrorMessage(createErr));
    } finally {
      setCreateLoading(false);
    }
  };

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

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Risk register</h2>
          <p className="text-sm text-slate-400">
            Track items that may impact the organisation and review changes over time.
          </p>
        </div>
        <button
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
          onClick={handleOpenModal}
          type="button"
        >
          New risk
        </button>
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

      <Modal
        title="Create new risk"
        description="Capture the basics to start tracking this risk."
        open={modalOpen}
        onClose={handleCloseModal}
        actions={
          <>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
              onClick={handleCloseModal}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={createLoading}
              onClick={handleCreate}
              type="button"
            >
              {createLoading ? "Saving..." : "Create risk"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-600">
          {createError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              {createError}
            </div>
          ) : null}
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Title
            </span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              onChange={(event) => handleFormChange("title", event.target.value)}
              required
              value={formState.title}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Description
            </span>
            <textarea
              className="min-h-[90px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              onChange={(event) => handleFormChange("description", event.target.value)}
              value={formState.description}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Severity
              </span>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                onChange={(event) => handleFormChange("severity", event.target.value)}
                value={formState.severity}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Likelihood
              </span>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                onChange={(event) => handleFormChange("likelihood", event.target.value)}
                value={formState.likelihood}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Impact
              </span>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                onChange={(event) => handleFormChange("impact", event.target.value)}
                value={formState.impact}
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              onChange={(event) => handleFormChange("status", event.target.value)}
              value={formState.status}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
