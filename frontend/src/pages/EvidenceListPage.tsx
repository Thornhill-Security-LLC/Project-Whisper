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

function formatSha(value?: string | null) {
  if (!value) {
    return "-";
  }
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
    formData.append("evidence_type", DEFAULT_EVIDENCE_TYPE);

    const trimmedTitle = uploadTitle.trim();
    if (trimmedTitle) {
      formData.append("title", trimmedTitle);
    }

    try {
      await uploadEvidence(organisationId, formData, identity ?? {});
      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadTitle("");
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
      try {
        if (item.storage_backend === "gcs") {
          const payload = await createEvidenceDownloadUrl(organisationId, item.id, identity ?? {});
          window.open(payload.url, "_blank", "noopener");
          return;
        }

        const blob = await downloadEvidenceFile(organisationId, item.id, identity ?? {});
        const objectUrl = window.URL.createObjectURL(blob);
        const opened = window.open(objectUrl, "_blank", "noopener");
        if (!opened) {
          window.location.href = objectUrl;
        }
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
            setDownloadError(resolveErrorMessage(fallbackError));
            return;
          }
        }
        setDownloadError(resolveErrorMessage(downloadErrorResponse));
      }
    },
    [identity, organisationId]
  );

  const rows = useMemo(
    () =>
      evidence.map((item) => [
        item.original_filename || item.title || "Untitled evidence",
        formatTimestamp(item.created_at ?? item.uploaded_at ?? null),
        formatSha(item.sha256),
        item.content_type || "-",
        item.storage_backend || "-",
        item.control_id || "-",
        <button
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:border-slate-300"
          key={`download-${item.id}`}
          onClick={() => handleDownload(item)}
          type="button"
        >
          Download
        </button>,
      ]),
    [evidence, handleDownload]
  );

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

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          Loading evidence...
        </div>
      ) : rows.length > 0 ? (
        <Table
          columns={[
            "File name",
            "Uploaded",
            "SHA",
            "Content type",
            "Storage",
            "Control",
            "",
          ]}
          rows={rows}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
          No evidence files yet. Upload one to get started.
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
              Title (optional)
            </label>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="SOC 2 report"
            />
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
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
