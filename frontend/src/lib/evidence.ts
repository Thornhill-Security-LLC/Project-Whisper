import { API_BASE_URL, ApiError, ApiSession, buildHeaders, fetchJson } from "./api";

export interface EvidenceItem {
  id: string;
  title?: string | null;
  evidence_type?: string | null;
  description?: string | null;
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

async function parseErrorMessage(response: Response): Promise<string> {
  const fallback = response.statusText || "Request failed";
  try {
    const data = (await response.clone().json()) as { detail?: string };
    if (data?.detail) {
      return data.detail;
    }
  } catch {
    // ignore
  }

  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

export async function listEvidence(
  organisationId: string,
  session: ApiSession
): Promise<EvidenceItem[]> {
  return fetchJson<EvidenceItem[]>(`/api/organisations/${organisationId}/evidence`, {}, session);
}

export async function uploadEvidence(
  organisationId: string,
  formData: FormData,
  session: ApiSession
): Promise<EvidenceItem> {
  const response = await fetch(
    `${API_BASE_URL}/api/organisations/${organisationId}/evidence/upload`,
    {
      method: "POST",
      headers: buildHeaders({}, session),
      body: formData,
    }
  );

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<EvidenceItem>;
}

export async function createEvidenceDownloadUrl(
  organisationId: string,
  evidenceId: string,
  session: ApiSession
): Promise<EvidenceDownloadUrl> {
  return fetchJson<EvidenceDownloadUrl>(
    `/api/organisations/${organisationId}/evidence/${evidenceId}/download-url`,
    {},
    session
  );
}

export async function downloadEvidenceFile(
  organisationId: string,
  evidenceId: string,
  session: ApiSession
): Promise<Blob> {
  const response = await fetch(
    `${API_BASE_URL}/api/organisations/${organisationId}/evidence/${evidenceId}/download`,
    {
      headers: buildHeaders({ headers: { Accept: "application/octet-stream" } }, session),
    }
  );

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(response.status, message);
  }

  return response.blob();
}
