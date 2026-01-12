import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../lib/api";
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
  downloadEvidenceFile,
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
  const { identity, status } = useAuth();
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
  const [selectedVersion, setSelectedVersion] = useState<ControlVersion | null>(null);
  const [viewVersionOpen, setViewVersionOpen] = useState(false);

  const organisationId = identity?.organisationId ?? null;
  const userId = identity?.userId ?? null;

  useEffect(() => {
    if (status === "needs-input") {
      navigate("/bootstrap", { replace: true });
    }
  }, [navigate, status]);

  const loadControl = useCallback(async () => {
    if (!organisationId || !userId || !controlId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [controlData, versionData, evidenceData] = await Promise.all([
        getControl(organisationId, controlId, identity ?? {}),
        listControlVersions(organisationId, controlId, identity ?? {}),
        listControlEvidence(organisationId, controlId, identity ?? {}),
      ]);
      setControl(controlData);
      setVersions(versionData);
      setEvidence(evidenceData);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [controlId, identity, organisationId, userId]);

  useEffect(() => {
    void loadControl();
  }, [loadControl]);

  const loadEvidenceOptions = useCallback(async () => {
    if (!organisationId || !userId) {
      return;
    }
    setEvidenceLoading(true);
    setLinkError(null);
    try {
      const data = await listEvidence(organisationId, identity ?? {});
      setEvidenceOptions(data);
    } catch (fetchError) {
      setLinkError(getApiErrorMessage(fetchError));
    } finally {
      setEvidenceLoading(false);
    }
  }, [identity, organisationId, userId]);

  useEffect(() => {
    if (linkModalOpen) {
      void loadEvidenceOptions();
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
    item.evidence_type || "-",
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

  const handleVersionSelect = (index: number) => {
    const version = versions[index];
    if (!version) {
      return;
    }
    setSelectedVersion(version);
    setViewVersionOpen(true);
  };

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
    if (!organisationId || !userId || !controlId) {
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
      await createControlVersion(organisationId, controlId, buildPayload(formState), identity ?? {});
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
      if (!organisationId || !item.id) {
        return;
      }
      setDownloadError(null);
      try {
        if (item.storage_backend === "gcs") {
          const payload = await createEvidenceDownloadUrl(organisationId, item.id, identity ?? {});
          window.open(payload.url, "_blank", "noopener");
          return;
        }

        const blob = await downloadEvidenceFile(organisationId, item.id, identity ?? {});
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = item.original_filename || item.title || "evidence";
        link.click();
        window.URL.revokeObjectURL(url);
      } catch (downloadErr) {
        setDownloadError(getApiErrorMessage(downloadErr));
      }
    },
    [identity, organisationId]
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
    if (!organisationId || !userId || !controlId) {
      navigate("/bootstrap", { replace: true });
      return;
    }

    if (!selectedEvidenceId) {
      setLinkError("Select an evidence item to link.");
      return;
    }

    setLinking(true);
    setLinkError(null);
    try {
      await linkEvidenceToControl(organisationId, controlId, selectedEvidenceId, identity ?? {});
      setBanner("Evidence linked to control.");
      setLinkModalOpen(false);
      const updated = await listControlEvidence(organisationId, controlId, identity ?? {});
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
              <p className="mt-3 whitespace-pre-line text-sm text-slate-600">
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
                onRowClick={(index) => handleVersionSelect(index)}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                No versions yet. Create a new version to start tracking history.
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Evidence</h3>
            </div>
            {evidence.length > 0 ? (
              <Table
                columns={[
                  "Filename",
                  "Type",
                  "Uploaded",
                  "SHA",
                  "Storage",
                  "",
                ]}
                rows={evidenceRows}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                No evidence linked yet. Use the button above to link evidence.
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Control not found.
        </div>
      )}

      <Modal
        open={createModalOpen}
        title="Create new control version"
        onClose={() => setCreateModalOpen(false)}
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
          <div className="grid gap-3 md:grid-cols-2">
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
                Framework
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={formState.framework}
                onChange={(event) => handleFormChange("framework", event.target.value)}
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
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={() => setCreateModalOpen(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={handleCreateVersion}
            type="button"
            disabled={createLoading}
          >
            {createLoading ? "Creating..." : "Create version"}
          </button>
        </div>
      </Modal>

      <Modal open={linkModalOpen} title="Link evidence" onClose={() => setLinkModalOpen(false)}>
        <div className="space-y-4">
          {linkError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {linkError}
            </div>
          ) : null}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Search
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={evidenceSearch}
              onChange={(event) => setEvidenceSearch(event.target.value)}
              placeholder="Search evidence"
            />
          </div>
          <div className="space-y-2">
            {evidenceLoading ? (
              <p className="text-sm text-slate-500">Loading evidence...</p>
            ) : filteredEvidenceOptions.length > 0 ? (
              filteredEvidenceOptions.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span>{item.original_filename || item.title || item.id}</span>
                  <input
                    type="radio"
                    name="evidence"
                    value={item.id}
                    checked={selectedEvidenceId === item.id}
                    onChange={() => setSelectedEvidenceId(item.id)}
                  />
                </label>
              ))
            ) : (
              <p className="text-sm text-slate-500">No evidence matches your search.</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={() => setLinkModalOpen(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            onClick={handleLinkEvidence}
            type="button"
            disabled={linking}
          >
            {linking ? "Linking..." : "Link evidence"}
          </button>
        </div>
      </Modal>

      <Modal
        open={viewVersionOpen}
        title="Version details"
        onClose={() => setViewVersionOpen(false)}
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            <span className="font-semibold text-slate-800">Version:</span>{" "}
            {selectedVersion?.version ?? "-"}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Summary:</span>{" "}
            {selectedVersion?.summary || selectedVersion?.title || "-"}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Created:</span>{" "}
            {formatTimestamp(selectedVersion?.created_at ?? null)}
          </p>
        </div>
      </Modal>
    </div>
  );
}
