import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import {
  createRiskVersion,
  getRisk,
  listRiskControls,
  listRiskVersions,
  type RiskDetail,
  type RiskPayload,
  type RiskVersion,
} from "../lib/risks";
import type { ControlSummary } from "../lib/controls";

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

export function RiskDetailPage() {
  const navigate = useNavigate();
  const { riskId } = useParams();
  const { identity, status } = useAuth();
  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [versions, setVersions] = useState<RiskVersion[]>([]);
  const [linkedControls, setLinkedControls] = useState<ControlSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
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

  const loadRisk = async () => {
    if (!organisationId || !userId || !riskId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [riskData, versionData, controlsData] = await Promise.all([
        getRisk(organisationId, riskId, identity ?? {}),
        listRiskVersions(organisationId, riskId, identity ?? {}),
        listRiskControls(organisationId, riskId, identity ?? {}),
      ]);
      setRisk(riskData);
      setVersions(versionData);
      setLinkedControls(controlsData);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRisk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, userId, identity?.email, riskId]);

  const overviewFields = useMemo(() => {
    if (!risk) {
      return [];
    }

    const fields = [
      { label: "Status", value: risk.status || "-" },
      { label: "Severity", value: risk.category || "-" },
      { label: "Likelihood", value: risk.likelihood?.toString() || "-" },
      { label: "Impact", value: risk.impact?.toString() || "-" },
      { label: "Created", value: formatTimestamp(risk.created_at) },
      { label: "Updated", value: formatTimestamp(risk.updated_at) },
    ];

    return fields;
  }, [risk]);

  const versionRows = versions.map((version, index) => {
    const actor = version.created_by_user_id || "-";
    return [
      version.version?.toString() || `${versions.length - index}`,
      formatTimestamp(version.created_at),
      actor,
      version.title || "-",
    ];
  });

  const controlRows = linkedControls.map((control) => [
    control.control_code || "-",
    control.title || "Untitled control",
    control.status || "-",
    formatTimestamp(control.updated_at ?? control.created_at ?? null),
  ]);

  const handleOpenModal = () => {
    if (!risk) {
      return;
    }
    setCreateError(null);
    setFormState({
      title: risk.title ?? "",
      description: risk.description ?? "",
      severity: risk.category ?? "",
      likelihood: risk.likelihood?.toString() ?? "",
      impact: risk.impact?.toString() ?? "",
      status: risk.status ?? "",
    });
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

  const handleCreateVersion = async () => {
    if (!organisationId || !userId || !riskId) {
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
      await createRiskVersion(organisationId, riskId, buildPayload(formState), identity ?? {});
      setBanner("New version created.");
      setModalOpen(false);
      await loadRisk();
    } catch (createErr) {
      setCreateError(`Failed to create version ${getApiErrorMessage(createErr)}`);
    } finally {
      setCreateLoading(false);
    }
  };

  if (!riskId) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
        Missing risk identifier.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner ? (
        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          {banner}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">{risk?.title || "—"}</h2>
            <p className="text-sm text-slate-400">Risk ID: {risk?.risk_id || "—"}</p>
          </div>
          <button
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
            onClick={handleOpenModal}
            type="button"
          >
            New version
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {overviewFields.map((field) => (
            <div key={field.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {field.label}
              </p>
              <p className="mt-2 text-sm text-slate-100">{field.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold text-slate-100">Version history</h3>
        <p className="mt-1 text-sm text-slate-400">Track changes made to this risk.</p>
        <div className="mt-4">
          <Table
            headers={["Version", "Created", "Actor", "Title"]}
            rows={versionRows}
            loading={loading}
            emptyState="No versions available yet."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold text-slate-100">Linked controls</h3>
        <p className="mt-1 text-sm text-slate-400">Controls mitigating this risk.</p>
        <div className="mt-4">
          <Table
            headers={["Control", "Title", "Status", "Last updated"]}
            rows={controlRows}
            loading={loading}
            emptyState="No controls linked yet."
          />
        </div>
      </section>

      <Modal open={modalOpen} title="New risk version" onClose={handleCloseModal}>
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
            onClick={handleCreateVersion}
            type="button"
            disabled={createLoading}
          >
            {createLoading ? "Saving..." : "Save version"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
