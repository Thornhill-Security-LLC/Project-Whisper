import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import {
  createIncident,
  listIncidents,
  type IncidentPayload,
  type IncidentSummary,
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

export function IncidentsPage() {
  const navigate = useNavigate();
  const { identity, status } = useAuth();
  const [incidents, setIncidents] = useState<IncidentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!organisationId || !userId) {
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    listIncidents(organisationId, identity ?? {})
      .then((data) => {
        if (isActive) {
          setIncidents(data);
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
    const total = incidents.length;
    const statusSet = new Set(incidents.map((incident) => incident.status).filter(Boolean));
    const latest = incidents
      .map((incident) => incident.updated_at ?? incident.created_at)
      .filter(Boolean)
      .sort()
      .pop();

    return {
      total,
      statusCount: statusSet.size,
      latestUpdate: formatTimestamp(latest ?? null),
    };
  }, [incidents]);

  const rows = incidents.map((incident) => [
    <Link
      key={incident.incident_id}
      className="text-sm font-semibold text-sky-600 hover:text-sky-500"
      to={`/incidents/${incident.incident_id}`}
    >
      {incident.incident_id}
    </Link>,
    <Link
      key={`${incident.incident_id}-title`}
      className="text-slate-700 hover:text-slate-900"
      to={`/incidents/${incident.incident_id}`}
    >
      {incident.title || "Untitled incident"}
    </Link>,
    incident.severity || "-",
    incident.status || "-",
    incident.latest_version?.toString() ?? "-",
    formatTimestamp(incident.updated_at ?? incident.created_at ?? null),
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

  const handleFormChange = (field: keyof IncidentFormState, value: string) => {
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
      const created = await createIncident(organisationId, buildPayload(formState), identity ?? {});
      setModalOpen(false);
      setFormState(emptyForm);
      navigate(`/incidents/${created.incident_id}`);
    } catch (createErr) {
      setCreateError(getApiErrorMessage(createErr));
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total incidents" value={stats.total.toString()} trend="Fetched live" />
        <StatCard
          label="Distinct statuses"
          value={stats.statusCount.toString()}
          trend="Live mix"
        />
        <StatCard label="Latest update" value={stats.latestUpdate} trend="Most recent" />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Incident queue</h2>
          <p className="text-sm text-slate-400">
            Monitor response progress and track severity shifts across incidents.
          </p>
        </div>
        <button
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400"
          onClick={handleOpenModal}
          type="button"
        >
          New incident
        </button>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <Table
        headers={["Incident ID", "Title", "Severity", "Status", "Latest version", "Last updated"]}
        rows={rows}
        loading={loading}
        emptyState="No incidents found for this organisation."
      />

      <Modal
        open={modalOpen}
        title="New incident"
        description="Capture the initial incident details and severity."
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
              placeholder="Suspicious login attempts"
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
              placeholder="Summarize the incident findings..."
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
                placeholder="Investigating"
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
                placeholder="Identity"
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
            {createLoading ? "Creating..." : "Create incident"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
