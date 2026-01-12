import { ApiAuthContext, ApiError, apiFetch, apiJson } from "./api";

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
): Promise<Blob> {
  const response = await apiFetch(
    `/api/organisations/${organisationId}/evidence/${evidenceId}/download`,
    {
      auth,
      headers: { Accept: "application/octet-stream" },
    }
  );

  try {
    return await response.blob();
  } catch (error) {
    throw new ApiError(500, "Failed to download evidence file", error);
  }
}
