import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";
import { useAuth } from "../contexts/AuthContext";
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
  const likelihood = Number(form.likelihood);
  const impact = Number(form.impact);
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    category: form.severity.trim() || null,
    likelihood: Number.isFinite(likelihood) ? likelihood : null,
    impact: Number.isFinite(impact) ? impact : null,
    status: form.status.trim() || null,
  };
}

export function RisksPage() {
  const navigate = useNavigate();
  const { identity, status } = useAuth();
  const [risks, setRisks] = useState<RiskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<RiskFormState>(emptyForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const organisationId = identity?.organisationId ?? null;
  const userId = identity?.userId ?? null;

  useEffect(() => {
    if (status === "needs-input") {
      navigate("/bootstrap", { replace: true });
    }
  }, [navigate, status]);

  useEffect(() => {
    if (!organisationId || !userId) {
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    listRisks(organisationId, identity ?? {})
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
  }, [organisationId, userId, identity?.email]);

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
    if (!organisationId || !userId) {
      navigate("/bootstrap", { replace: true });
      return;
    }

    if (!formState.title.trim()) {
      setCreateError("Title is required.");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      const created = await createRisk(organisationId, buildPayload(formState), identity ?? {});
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

      {error ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <Table
        headers={["Risk ID", "Title", "Status", "Last updated"]}
        rows={rows}
        loading={loading}
        emptyState={"No risks found for this organisation."}
      />

      <Modal open={modalOpen} title="New risk" onClose={handleCloseModal}>
        <div className="space-y-4">
          {createError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {createError}
            </div>
          ) : null}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formState.title}
              onChange={(event) => handleFormChange("title", event.target.value)}
              placeholder="Vendor data breach risk"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description
            </label>
            <textarea
              className="mt-2 min-h-[96px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={formState.description}
              onChange={(event) => handleFormChange("description", event.target.value)}
              placeholder="Describe the risk..."
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Severity
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.severity}
                onChange={(event) => handleFormChange("severity", event.target.value)}
                placeholder="High"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.status}
                onChange={(event) => handleFormChange("status", event.target.value)}
                placeholder="Open"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Likelihood
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.likelihood}
                onChange={(event) => handleFormChange("likelihood", event.target.value)}
                placeholder="0.5"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Impact
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.impact}
                onChange={(event) => handleFormChange("impact", event.target.value)}
                placeholder="0.7"
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={handleCloseModal}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={handleCreate}
            type="button"
            disabled={createLoading}
          >
            {createLoading ? "Creating..." : "Create risk"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
