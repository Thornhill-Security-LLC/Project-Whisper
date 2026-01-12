import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../lib/api";
import { createControl, listControls, type ControlSummary } from "../lib/controls";

type ControlFormState = {
  title: string;
  description: string;
  status: string;
  framework: string;
  controlCode: string;
};

const emptyForm: ControlFormState = {
  title: "",
  description: "",
  status: "",
  framework: "",
  controlCode: "",
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
  const { identity, status } = useAuth();
  const [controls, setControls] = useState<ControlSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<ControlFormState>(emptyForm);
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

    listControls(organisationId, identity ?? {})
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
  }, [organisationId, userId, identity?.email]);

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
    <button
      className="text-left text-sm font-semibold text-slate-900 hover:text-brand-500"
      key={`control-${control.control_id}`}
      onClick={() => navigate(`/controls/${control.control_id}`)}
      type="button"
    >
      {control.title || "Untitled control"}
    </button>,
    control.status || "-",
    control.framework || "-",
  ]);

  const handleOpenModal = () => {
    setCreateError(null);
    setFormState(emptyForm);
    setModalOpen(true);
  };

  const handleFormChange = (field: keyof ControlFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateControl = async () => {
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
      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim() || null,
        status: formState.status.trim() || "draft",
        framework: formState.framework.trim() || null,
        control_code: formState.controlCode.trim() || formState.title.trim(),
      };
      const created = await createControl(organisationId, payload, identity ?? {});
      setModalOpen(false);
      navigate(`/controls/${created.control_id}`);
    } catch (createErr) {
      setCreateError(`Failed to create control ${getApiErrorMessage(createErr)}`);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Control library</h2>
          <p className="mt-2 text-sm text-slate-500">
            Track control coverage, version history, and linked evidence.
          </p>
        </div>
        <button
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          onClick={handleOpenModal}
          type="button"
        >
          New control
        </button>
      </section>
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
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            No controls yet. Use the "New control" button to add one.
          </div>
        )}
      </section>

      <Modal open={modalOpen} title="New control" onClose={() => setModalOpen(false)}>
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
              placeholder="SOC 2 CC1.1"
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
              placeholder="Describe the control and testing approach."
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.status}
                onChange={(event) => handleFormChange("status", event.target.value)}
                placeholder="draft"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Framework
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.framework}
                onChange={(event) => handleFormChange("framework", event.target.value)}
                placeholder="SOC 2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Control code
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.controlCode}
                onChange={(event) => handleFormChange("controlCode", event.target.value)}
                placeholder="CC1.1"
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={() => setModalOpen(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={handleCreateControl}
            type="button"
            disabled={createLoading}
          >
            {createLoading ? "Creating..." : "Create control"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
