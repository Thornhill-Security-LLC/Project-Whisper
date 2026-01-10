import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { useSession } from "../context/SessionContext";
import { getApiErrorMessage } from "../lib/api";
import {
  createRiskVersion,
  getRisk,
  listRiskVersions,
  type RiskDetail,
  type RiskPayload,
  type RiskVersion,
} from "../lib/risks";

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
  const { session } = useSession();
  const [risk, setRisk] = useState<RiskDetail | null>(null);
  const [versions, setVersions] = useState<RiskVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<RiskFormState>(emptyForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.orgId || !session?.actorUserId) {
      navigate("/login", { replace: true });
    }
  }, [navigate, session?.orgId, session?.actorUserId]);

  const loadRisk = async () => {
    if (!session?.orgId || !session?.actorUserId || !riskId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [riskData, versionData] = await Promise.all([
        getRisk(session.orgId, riskId, session),
        listRiskVersions(session.orgId, riskId, session),
      ]);
      setRisk(riskData);
      setVersions(versionData);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRisk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.orgId, session?.actorUserId, session?.actorEmail, session?.authToken, riskId]);

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
    if (!session?.orgId || !session?.actorUserId || !riskId) {
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
      await createRiskVersion(session.orgId, riskId, buildPayload(formState), session);
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {banner}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Loading risk details...
        </div>
      ) : risk ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Risk {risk.risk_id}
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {risk.title || "Untitled risk"}
                </h2>
              </div>
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={handleOpenModal}
                type="button"
              >
                Create new version
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overviewFields.map((field) => (
                <div key={field.label} className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {field.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {risk.description ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">Description</h3>
              <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">
                {risk.description}
              </p>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Version history</h3>
            </div>
            {versions.length > 0 ? (
              <Table
                columns={["Version", "Created", "Actor", "Title"]}
                rows={versionRows}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                No versions have been recorded yet.
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Risk details are unavailable.
        </div>
      )}

      <Modal
        title="Create a new version"
        description="Capture the updated fields to add to version history."
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
              onClick={handleCreateVersion}
              type="button"
            >
              {createLoading ? "Saving..." : "Create version"}
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
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Version summary
            </span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              disabled
              value="Version summaries are not supported yet."
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
