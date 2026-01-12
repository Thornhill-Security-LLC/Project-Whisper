import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import {
  createIncidentVersion,
  getIncident,
  listIncidentVersions,
  type IncidentDetail,
  type IncidentPayload,
  type IncidentVersion,
} from "../lib/incidents";

type IncidentFormState = {
  title: string;
  description: string;
  severity: string;
  status: string;
  category: string;
};

const emptyForm: IncidentFormState = {
  title: "",
  description: "",
  severity: "",
  status: "",
  category: "",
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

function buildPayload(form: IncidentFormState): IncidentPayload {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    severity: form.severity.trim() || null,
    status: form.status.trim() || null,
    category: form.category.trim() || null,
  };
}

export function IncidentDetailPage() {
  const navigate = useNavigate();
  const { incidentId } = useParams();
  const { identity, status } = useAuth();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [versions, setVersions] = useState<IncidentVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<IncidentVersion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<IncidentFormState>(emptyForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const organisationId = identity?.organisationId ?? null;
  const userId = identity?.userId ?? null;

  useEffect(() => {
    if (status === "needs-input") {
      navigate("/bootstrap", { replace: true });
    }
  }, [navigate, status]);

  const loadIncident = async () => {
    if (!organisationId || !userId || !incidentId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [incidentData, versionData] = await Promise.all([
        getIncident(organisationId, incidentId, identity ?? {}),
        listIncidentVersions(organisationId, incidentId, identity ?? {}),
      ]);
      setIncident(incidentData);
      setVersions(versionData);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIncident();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organisationId, userId, identity?.email, incidentId]);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedVersion(null);
      return;
    }
    const existing = selectedVersion
      ? versions.find((version) => version.id === selectedVersion.id)
      : null;
    setSelectedVersion(existing ?? versions[0]);
  }, [versions, selectedVersion]);

  const activeVersion = selectedVersion ?? versions[0] ?? null;
  const latestVersion = versions[0] ?? null;

  const overviewFields = useMemo(() => {
    if (!incident || !activeVersion) {
      return [];
    }

    const fields = [
      { label: "Status", value: activeVersion.status || "-" },
      { label: "Severity", value: activeVersion.severity || "-" },
      { label: "Category", value: activeVersion.category || "-" },
      { label: "Latest version", value: incident.latest_version?.toString() || "-" },
      { label: "Created", value: formatTimestamp(incident.created_at) },
      { label: "Updated", value: formatTimestamp(incident.updated_at) },
    ];

    return fields;
  }, [incident, activeVersion]);

  const versionRows = versions.map((version) => [
    version.version?.toString() || "-",
    formatTimestamp(version.created_at),
    version.status || "-",
    version.severity || "-",
    version.title || "-",
  ]);

  const handleOpenModal = () => {
    const base = latestVersion ?? activeVersion;
    if (!base) {
      return;
    }
    setCreateError(null);
    setFormState({
      title: base.title ?? "",
      description: base.description ?? "",
      severity: base.severity ?? "",
      status: base.status ?? "",
      category: base.category ?? "",
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!createLoading) {
      setModalOpen(false);
    }
  };

  const handleFormChange = (field: keyof IncidentFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectVersion = (index: number) => {
    const version = versions[index];
    if (version) {
      setSelectedVersion(version);
    }
  };

  const handleCreateVersion = async () => {
    if (!organisationId || !userId || !incidentId) {
      navigate("/bootstrap", { replace: true });
      return;
    }

    if (!formState.title.trim()) {
      setCreateError("Title is required.");
      return;
    }
    if (!formState.severity.trim()) {
      setCreateError("Severity is required.");
      return;
    }
    if (!formState.status.trim()) {
      setCreateError("Status is required.");
      return;
    }

    setCreateLoading(true);
    setCreateError(null);
    try {
      await createIncidentVersion(organisationId, incidentId, buildPayload(formState), identity ?? {});
      setBanner("New version created.");
      setModalOpen(false);
      await loadIncident();
    } catch (createErr) {
      setCreateError(`Failed to create version ${getApiErrorMessage(createErr)}`);
    } finally {
      setCreateLoading(false);
    }
  };

  if (!incidentId) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
        Missing incident identifier.
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
            <h2 className="text-xl font-semibold text-slate-100">
              {activeVersion?.title || incident?.title || "—"}
            </h2>
            <p className="text-sm text-slate-400">Incident ID: {incident?.incident_id || "—"}</p>
            {activeVersion?.version ? (
              <p className="mt-1 text-xs text-slate-500">Viewing version {activeVersion.version}</p>
            ) : null}
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

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-lg font-semibold text-slate-100">Incident narrative</h3>
          <p className="mt-2 text-sm text-slate-400">
            {activeVersion?.description || "No narrative captured for this version yet."}
          </p>
          <div className="mt-4 grid gap-3 text-sm text-slate-400">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className="mt-1 text-sm text-slate-100">{activeVersion?.status || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Severity
              </p>
              <p className="mt-1 text-sm text-slate-100">{activeVersion?.severity || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
              </p>
              <p className="mt-1 text-sm text-slate-100">{activeVersion?.category || "-"}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-sm font-semibold text-slate-100">Version snapshot</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-400">
            <p>
              <span className="text-slate-500">Version:</span> {activeVersion?.version ?? "-"}
            </p>
            <p>
              <span className="text-slate-500">Created:</span> {formatTimestamp(activeVersion?.created_at)}
            </p>
            <p>
              <span className="text-slate-500">Owner:</span> {activeVersion?.owner_user_id ?? "-"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold text-slate-100">Version history</h3>
        <p className="mt-1 text-sm text-slate-400">
          Click a row to review a previous incident version.
        </p>
        <div className="mt-4">
          <Table
            headers={["Version", "Created", "Status", "Severity", "Title"]}
            rows={versionRows}
            loading={loading}
            emptyState="No versions available yet."
            onRowClick={handleSelectVersion}
          />
        </div>
      </section>

      <Modal
        open={modalOpen}
        title="New incident version"
        description="Capture changes to the incident timeline, severity, or status."
        onClose={handleCloseModal}
      >
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
          <div className="grid gap-3 md:grid-cols-3">
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
                Category
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.category}
                onChange={(event) => handleFormChange("category", event.target.value)}
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
