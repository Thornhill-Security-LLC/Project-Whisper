import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { useSession } from "../context/SessionContext";
import { API_BASE_URL, getApiErrorMessage } from "../lib/api";
import {
  createControlVersion,
  getControl,
  listControlEvidence,
  listControlVersions,
  type ControlDetail,
  type ControlPayload,
  type ControlVersion,
  linkEvidenceToControl,
} from "../lib/controls";
import {
  createEvidenceDownloadUrl,
  listEvidence,
  type EvidenceItem,
} from "../lib/evidence";

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

function formatSha(value?: string | null) {
  if (!value) {
    return "-";
  }
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function buildPayload(form: ControlFormState): ControlPayload {
  const title = form.title.trim();
  const controlCode = form.controlCode.trim() || title;
  return {
    title,
    control_code: controlCode,
    description: form.description.trim() || null,
    framework: form.framework.trim() || null,
    status: form.status.trim() || "draft",
  };
}

export function ControlDetailPage() {
  const navigate = useNavigate();
  const { controlId } = useParams();
  const { session } = useSession();
  const [control, setControl] = useState<ControlDetail | null>(null);
  const [versions, setVersions] = useState<ControlVersion[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formState, setFormState] = useState<ControlFormState>(emptyForm);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [evidenceOptions, setEvidenceOptions] = useState<EvidenceItem[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>("");

  useEffect(() => {
    if (!session?.orgId || !session.actorUserId) {
      navigate("/login", { replace: true });
    }
  }, [navigate, session?.orgId, session?.actorUserId]);

  const loadControl = useCallback(async () => {
    if (!session?.orgId || !session.actorUserId || !controlId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [controlData, versionData, evidenceData] = await Promise.all([
        getControl(session.orgId, controlId, session),
        listControlVersions(session.orgId, controlId, session),
        listControlEvidence(session.orgId, controlId, session),
      ]);
      setControl(controlData);
      setVersions(versionData);
      setEvidence(evidenceData);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [controlId, session]);

  useEffect(() => {
    loadControl();
  }, [loadControl]);

  const loadEvidenceOptions = useCallback(async () => {
    if (!session?.orgId || !session.actorUserId) {
      return;
    }
    setEvidenceLoading(true);
    setLinkError(null);
    try {
      const data = await listEvidence(session.orgId, session);
      setEvidenceOptions(data);
    } catch (fetchError) {
      setLinkError(getApiErrorMessage(fetchError));
    } finally {
      setEvidenceLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (linkModalOpen) {
      loadEvidenceOptions();
      setEvidenceSearch("");
      setSelectedEvidenceId("");
    }
  }, [linkModalOpen, loadEvidenceOptions]);

  const overviewFields = useMemo(() => {
    if (!control) {
      return [];
    }

    return [
      { label: "Status", value: control.status || "-" },
      { label: "Framework", value: control.framework || "-" },
      { label: "Control code", value: control.control_code || "-" },
      { label: "Latest version", value: control.latest_version?.toString() || "-" },
      { label: "Created", value: formatTimestamp(control.created_at) },
      { label: "Updated", value: formatTimestamp(control.updated_at) },
    ];
  }, [control]);

  const versionRows = versions.map((version, index) => {
    const actor = version.created_by_user_id || "-";
    const summary = version.summary || version.title || "-";
    return [
      version.version?.toString() || `${versions.length - index}`,
      formatTimestamp(version.created_at),
      actor,
      summary,
    ];
  });

  const evidenceRows = evidence.map((item) => [
    item.original_filename || item.title || "Untitled evidence",
    formatTimestamp(item.created_at ?? item.uploaded_at ?? null),
    formatSha(item.sha256),
    item.storage_backend || "-",
    <button
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300"
      key={`download-${item.id}`}
      onClick={() => handleDownload(item)}
      type="button"
    >
      Download
    </button>,
  ]);

  const handleOpenCreateModal = () => {
    if (!control) {
      return;
    }
    setCreateError(null);
    setFormState({
      title: control.title ?? "",
      description: control.description ?? "",
      status: control.status ?? "",
      framework: control.framework ?? "",
      controlCode: control.control_code ?? "",
    });
    setCreateModalOpen(true);
  };

  const handleFormChange = (field: keyof ControlFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateVersion = async () => {
    if (!session?.orgId || !session.actorUserId || !controlId) {
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
      await createControlVersion(session.orgId, controlId, buildPayload(formState), session);
      setBanner("New control version created.");
      setCreateModalOpen(false);
      await loadControl();
    } catch (createErr) {
      setCreateError(`Failed to create version ${getApiErrorMessage(createErr)}`);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDownload = useCallback(
    async (item: EvidenceItem) => {
      if (!session?.orgId || !item.id) {
        return;
      }
      setDownloadError(null);
      try {
        if (item.storage_backend === "gcs") {
          const payload = await createEvidenceDownloadUrl(session.orgId, item.id, session);
          window.open(payload.url, "_blank", "noopener");
          return;
        }

        const downloadUrl = `${API_BASE_URL}/api/organisations/${session.orgId}/evidence/${item.id}/download`;
        const opened = window.open(downloadUrl, "_blank", "noopener");
        if (!opened) {
          window.location.href = downloadUrl;
        }
      } catch (downloadErr) {
        setDownloadError(getApiErrorMessage(downloadErr));
      }
    },
    [session]
  );

  const filteredEvidenceOptions = useMemo(() => {
    const term = evidenceSearch.trim().toLowerCase();
    if (!term) {
      return evidenceOptions;
    }
    return evidenceOptions.filter((item) => {
      const name =
        item.original_filename || item.title || item.description || item.id || "";
      return name.toLowerCase().includes(term);
    });
  }, [evidenceOptions, evidenceSearch]);

  const handleLinkEvidence = async () => {
    if (!session?.orgId || !session.actorUserId || !controlId) {
      navigate("/login", { replace: true });
      return;
    }

    if (!selectedEvidenceId) {
      setLinkError("Select an evidence item to link.");
      return;
    }

    setLinking(true);
    setLinkError(null);
    try {
      await linkEvidenceToControl(session.orgId, controlId, selectedEvidenceId, session);
      setBanner("Evidence linked to control.");
      setLinkModalOpen(false);
      const updated = await listControlEvidence(session.orgId, controlId, session);
      setEvidence(updated);
    } catch (linkErr) {
      setLinkError(`Failed to link evidence ${getApiErrorMessage(linkErr)}`);
    } finally {
      setLinking(false);
    }
  };

  if (!controlId) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
        Missing control identifier.
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
      {downloadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {downloadError}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Loading control details...
        </div>
      ) : control ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Control {control.control_id}
                </p>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {control.title || "Untitled control"}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300"
                  onClick={() => setLinkModalOpen(true)}
                  type="button"
                >
                  Link existing evidence
                </button>
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  onClick={handleOpenCreateModal}
                  type="button"
                >
                  Create new version
                </button>
              </div>
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

          {control.description ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-slate-900">Description</h3>
              <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">
                {control.description}
              </p>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Version history</h3>
            </div>
            {versions.length > 0 ? (
              <Table
                columns={["Version", "Created", "Actor", "Summary"]}
                rows={versionRows}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                No versions have been recorded yet.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Linked evidence</h3>
            </div>
            {evidence.length > 0 ? (
              <Table
                columns={["File", "Created", "SHA-256", "Storage", "Actions"]}
                rows={evidenceRows}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                No evidence linked to this control yet.
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Control details are unavailable.
        </div>
      )}

      <Modal
        title="Create a new version"
        description="Capture the updated fields to add to control version history."
        open={createModalOpen}
        onClose={() => {
          if (!createLoading) {
            setCreateModalOpen(false);
          }
        }}
        actions={
          <>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
              onClick={() => setCreateModalOpen(false)}
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
          <div className="grid gap-3 md:grid-cols-2">
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
                Framework
              </span>
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                onChange={(event) => handleFormChange("framework", event.target.value)}
                value={formState.framework}
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Control code
            </span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              onChange={(event) => handleFormChange("controlCode", event.target.value)}
              value={formState.controlCode}
            />
          </label>
        </div>
      </Modal>

      <Modal
        title="Link existing evidence"
        description="Select an evidence item to associate with this control."
        open={linkModalOpen}
        onClose={() => {
          if (!linking) {
            setLinkModalOpen(false);
          }
        }}
        actions={
          <>
            <button
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
              onClick={() => setLinkModalOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              disabled={linking}
              onClick={handleLinkEvidence}
              type="button"
            >
              {linking ? "Linking..." : "Link evidence"}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-slate-600">
          {linkError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
              {linkError}
            </div>
          ) : null}
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search evidence
            </span>
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              onChange={(event) => setEvidenceSearch(event.target.value)}
              placeholder="Search by file name, title, or ID"
              value={evidenceSearch}
            />
          </label>
          {evidenceLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Loading evidence...
            </div>
          ) : filteredEvidenceOptions.length > 0 ? (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {filteredEvidenceOptions.map((item) => {
                const label =
                  item.original_filename || item.title || item.description || item.id;
                return (
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 hover:border-slate-300"
                    key={item.id}
                  >
                    <input
                      checked={selectedEvidenceId === item.id}
                      name="evidence"
                      onChange={() => setSelectedEvidenceId(item.id)}
                      type="radio"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{label}</p>
                      <p className="text-xs text-slate-500">
                        {formatTimestamp(item.created_at ?? item.uploaded_at ?? null)} ·{" "}
                        {formatSha(item.sha256)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              No evidence matches this search.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
