import { ApiAuthContext, ApiError, apiFetch, apiJson, getApiErrorMessage } from "./api";

export interface EvidenceItem {
  id: string;
  title?: string | null;
  evidence_type?: string | null;
  description?: string | null;
  source?: string | null;
  external_uri?: string | null;
  storage_backend?: string | null;
  object_key?: string | null;
  original_filename?: string | null;
  sha256?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  uploaded_at?: string | null;
  created_at?: string | null;
  control_id?: string | null;
}

export interface EvidenceDownloadUrl {
  url: string;
  expires_in: number;
}

export interface EvidenceDownloadResult {
  blob: Blob;
  filename?: string | null;
}

function parseFilenameFromDisposition(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const filenameMatch = value.match(/filename="?([^\";]+)"?/i);
  if (filenameMatch?.[1]) {
    return filenameMatch[1];
  }

  return null;
}

export async function listEvidence(
  organisationId: string,
  auth: ApiAuthContext
): Promise<EvidenceItem[]> {
  return apiJson<EvidenceItem[]>(`/api/organisations/${organisationId}/evidence`, {
    auth,
  });
}

export async function uploadEvidence(
  organisationId: string,
  formData: FormData,
  auth: ApiAuthContext
): Promise<EvidenceItem> {
  const response = await apiFetch(
    `/api/organisations/${organisationId}/evidence/upload`,
    {
      method: "POST",
      auth,
      body: formData,
    }
  );

  return response.json() as Promise<EvidenceItem>;
}

export async function createEvidenceDownloadUrl(
  organisationId: string,
  evidenceId: string,
  auth: ApiAuthContext
): Promise<EvidenceDownloadUrl> {
  return apiJson<EvidenceDownloadUrl>(
    `/api/organisations/${organisationId}/evidence/${evidenceId}/download-url`,
    { auth }
  );
}

export async function downloadEvidenceFile(
  organisationId: string,
  evidenceId: string,
  auth: ApiAuthContext
): Promise<EvidenceDownloadResult> {
  const response = await apiFetch(
    `/api/organisations/${organisationId}/evidence/${evidenceId}/download`,
    {
      auth,
      headers: { Accept: "application/octet-stream" },
    }
  );

  try {
    const blob = await response.blob();
    const filename = parseFilenameFromDisposition(
      response.headers.get("Content-Disposition")
    );
    return { blob, filename };
  } catch (error) {
    throw new ApiError(500, "Failed to download evidence file", error);
  }
}

export function getEvidenceDownloadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "You do not have permission to download this evidence.";
      case 404:
        return "We could not find that evidence file.";
      case 500:
        return "The server ran into an issue while preparing the download.";
      default:
        return getApiErrorMessage(error);
    }
  }
  return getApiErrorMessage(error);
}
