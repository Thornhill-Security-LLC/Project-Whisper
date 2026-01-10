import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { StatCard } from "../components/StatCard";
import { Table } from "../components/Table";
import { useSession } from "../context/SessionContext";
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
  const { session } = useSession();
  const [controls, setControls] = useState<ControlSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<ControlFormState>(emptyForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

    listControls(session.orgId, {
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
    if (!session?.orgId || !session.actorUserId) {
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
      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim() || null,
        status: formState.status.trim() || "draft",
        framework: formState.framework.trim() || null,
        control_code: formState.controlCode.trim() || formState.title.trim(),
      };
      const created = await createControl(session.orgId, payload, session);
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
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
            No controls found for this organisation yet.
          </div>
        )}
      </section>

      <Modal
        title="Create a new control"
        description="Add a control to your library and start tracking versions."
        open={modalOpen}
        onClose={() => {
          if (!createLoading) {
            setModalOpen(false);
          }
        }}
        actions={
          <>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
              onClick={() => setModalOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              disabled={createLoading}
              onClick={handleCreateControl}
              type="button"
            >
              {createLoading ? "Saving..." : "Create control"}
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
              Name / Title
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
              Description (optional)
            </span>
            <textarea
              className="min-h-[90px] rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              onChange={(event) => handleFormChange("description", event.target.value)}
              value={formState.description}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Status (optional)
              </span>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                onChange={(event) => handleFormChange("status", event.target.value)}
                placeholder="draft"
                value={formState.status}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Framework mapping (optional)
              </span>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                onChange={(event) => handleFormChange("framework", event.target.value)}
                placeholder="SOC 2"
                value={formState.framework}
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Control code (optional)
            </span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              onChange={(event) => handleFormChange("controlCode", event.target.value)}
              placeholder="CC-1"
              value={formState.controlCode}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
