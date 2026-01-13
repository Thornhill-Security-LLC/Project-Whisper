import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { useAuth } from "../contexts/AuthContext";
import { ApiError, getApiErrorMessage } from "../lib/api";
import {
  createEvidenceDownloadUrl,
  downloadEvidenceFile,
  EvidenceItem,
  getEvidenceDownloadErrorMessage,
  listEvidence,
  uploadEvidence,
} from "../lib/evidence";

const DEFAULT_EVIDENCE_TYPE = "policy";

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

function resolveErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.message) {
    return error.message;
  }
  return getApiErrorMessage(error);
}

export function EvidenceListPage() {
  const navigate = useNavigate();
  const { identity, status } = useAuth();
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [uploadExternalUri, setUploadExternalUri] = useState("");
  const [uploadType, setUploadType] = useState(DEFAULT_EVIDENCE_TYPE);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const organisationId = identity?.organisationId ?? null;
  const userId = identity?.userId ?? null;

  const refreshEvidence = useCallback(() => {
    if (!organisationId || !userId) {
      return;
    }

    let isActive = true;
    setLoading(true);
    setError(null);

    listEvidence(organisationId, identity ?? {})
      .then((data) => {
        if (isActive) {
          setEvidence(data);
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
  }, [identity, organisationId, userId]);

  useEffect(() => {
    if (status === "needs-input") {
      navigate("/bootstrap", { replace: true });
    }
  }, [navigate, status]);

  useEffect(() => {
    const cleanup = refreshEvidence();
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [refreshEvidence]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleUploadSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organisationId || !userId) {
      return;
    }

    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", uploadFile);
    const trimmedType = uploadType.trim() || DEFAULT_EVIDENCE_TYPE;
    formData.append("evidence_type", trimmedType);

    const trimmedTitle = uploadTitle.trim();
    if (trimmedTitle) {
      formData.append("title", trimmedTitle);
    }

    const trimmedDescription = uploadDescription.trim();
    if (trimmedDescription) {
      formData.append("description", trimmedDescription);
    }

    const trimmedSource = uploadSource.trim();
    if (trimmedSource) {
      formData.append("source", trimmedSource);
    }

    const trimmedExternalUri = uploadExternalUri.trim();
    if (trimmedExternalUri) {
      formData.append("external_uri", trimmedExternalUri);
    }

    try {
      await uploadEvidence(organisationId, formData, identity ?? {});
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadDescription("");
      setUploadSource("");
      setUploadExternalUri("");
      setUploadType(DEFAULT_EVIDENCE_TYPE);
      setToast("Evidence uploaded");
      refreshEvidence();
    } catch (uploadErrorResponse) {
      setUploadError(resolveErrorMessage(uploadErrorResponse));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = useCallback(
    async (item: EvidenceItem) => {
      if (!organisationId || !item.id) {
        return;
      }

      setDownloadError(null);
      setDownloadingId(item.id);
      try {
        if (item.storage_backend === "gcs") {
          const payload = await createEvidenceDownloadUrl(organisationId, item.id, identity ?? {});
          window.open(payload.url, "_blank", "noopener");
          return;
        }

        const { blob, filename } = await downloadEvidenceFile(
          organisationId,
          item.id,
          identity ?? {}
        );
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download =
          filename || item.original_filename || item.title || "evidence-download";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
      } catch (downloadErrorResponse) {
        if (
          downloadErrorResponse instanceof ApiError &&
          downloadErrorResponse.status === 409 &&
          downloadErrorResponse.message.includes("download-url")
        ) {
          try {
            const payload = await createEvidenceDownloadUrl(
              organisationId,
              item.id,
              identity ?? {}
            );
            window.open(payload.url, "_blank", "noopener");
            return;
          } catch (fallbackError) {
            setDownloadError(getEvidenceDownloadErrorMessage(fallbackError));
            return;
          }
        }
        setDownloadError(getEvidenceDownloadErrorMessage(downloadErrorResponse));
      } finally {
        setDownloadingId(null);
      }
    },
    [identity, organisationId]
  );

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    evidence.forEach((item) => {
      if (item.evidence_type) {
        values.add(item.evidence_type);
      }
    });
    return Array.from(values).sort();
  }, [evidence]);

  const sourceOptions = useMemo(() => {
    const values = new Set<string>();
    evidence.forEach((item) => {
      if (item.source) {
        values.add(item.source);
      }
    });
    return Array.from(values).sort();
  }, [evidence]);

  const filteredEvidence = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return evidence.filter((item) => {
      if (typeFilter !== "all" && item.evidence_type !== typeFilter) {
        return false;
      }
      if (sourceFilter !== "all" && item.source !== sourceFilter) {
        return false;
      }
      if (!term) {
        return true;
      }
      const title = item.title || "";
      return title.toLowerCase().includes(term);
    });
  }, [evidence, searchTerm, sourceFilter, typeFilter]);

  const rows = useMemo(
    () =>
      filteredEvidence.map((item) => [
        item.title || "-",
        item.evidence_type || "-",
        item.source || "-",
        item.original_filename || "-",
        item.storage_backend || "-",
        formatTimestamp(item.uploaded_at ?? null),
        formatTimestamp(item.created_at ?? null),
        <button
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
          key={`download-${item.id}`}
          onClick={() => handleDownload(item)}
          type="button"
          disabled={downloadingId === item.id}
        >
          {downloadingId === item.id ? "Downloading..." : "Download"}
        </button>,
      ]),
    [downloadingId, filteredEvidence, handleDownload]
  );

  const hasEvidence = evidence.length > 0;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Evidence library</h2>
          <p className="mt-2 text-sm text-slate-500">
            Upload and track audit-ready evidence files for this organisation.
          </p>
        </div>
        <button
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          onClick={() => {
            setIsUploadOpen(true);
            setUploadError(null);
          }}
          type="button"
        >
          Upload evidence
        </button>
      </section>

      {toast ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {toast}
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

      <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Search title
          </label>
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search evidence titles"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Type
          </label>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            {typeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source
          </label>
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
          >
            <option value="all">All sources</option>
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Loading evidence...
        </div>
      ) : rows.length > 0 ? (
        <Table
          columns={[
            "Title",
            "Type",
            "Source",
            "Filename",
            "Storage backend",
            "Uploaded at",
            "Created at",
            "",
          ]}
          rows={rows}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          {hasEvidence
            ? "No evidence matches the current filters."
            : "No evidence files yet. Upload one to get started."}
        </div>
      )}

      <Modal open={isUploadOpen} title="Upload evidence" onClose={() => setIsUploadOpen(false)}>
        <form className="space-y-4" onSubmit={handleUploadSubmit}>
          {uploadError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {uploadError}
            </div>
          ) : null}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              File
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              type="file"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evidence type
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={uploadType}
              onChange={(event) => setUploadType(event.target.value)}
              placeholder="policy"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title (optional)
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="SOC 2 report"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Description (optional)
            </label>
            <textarea
              className="mt-2 min-h-[96px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={uploadDescription}
              onChange={(event) => setUploadDescription(event.target.value)}
              placeholder="Summary of the evidence contents"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Source (optional)
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={uploadSource}
                onChange={(event) => setUploadSource(event.target.value)}
                placeholder="Vendor portal"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                External URL (optional)
              </label>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={uploadExternalUri}
                onChange={(event) => setUploadExternalUri(event.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => setIsUploadOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-300"
              type="submit"
              disabled={isUploading || !uploadFile}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
