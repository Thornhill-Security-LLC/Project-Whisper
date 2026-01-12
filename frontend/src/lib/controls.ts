import { ApiAuthContext, apiJson } from "./api";
import type { EvidenceItem } from "./evidence";

export interface ControlSummary {
  control_id: string;
  latest_version?: number | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  framework?: string | null;
  control_code?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ControlDetail extends ControlSummary {
  owner_user_id?: string | null;
}

export interface ControlVersion {
  id?: string | null;
  organisation_id?: string | null;
  control_id?: string | null;
  version?: number | string | null;
  control_code?: string | null;
  description?: string | null;
  framework?: string | null;
  status?: string | null;
  owner_user_id?: string | null;
  created_at?: string | null;
  created_by_user_id?: string | null;
  title?: string | null;
  summary?: string | null;
}

export interface ControlPayload {
  title: string;
  control_code: string;
  status: string;
  description?: string | null;
  framework?: string | null;
}

export async function listControls(organisationId: string, auth: ApiAuthContext) {
  return apiJson<ControlSummary[]>(`/api/organisations/${organisationId}/controls`, {
    auth,
  });
}

export async function getControl(
  organisationId: string,
  controlId: string,
  auth: ApiAuthContext
) {
  return apiJson<ControlDetail>(
    `/api/organisations/${organisationId}/controls/${controlId}`,
    { auth }
  );
}

export async function listControlVersions(
  organisationId: string,
  controlId: string,
  auth: ApiAuthContext
) {
  return apiJson<ControlVersion[]>(
    `/api/organisations/${organisationId}/controls/${controlId}/versions`,
    { auth }
  );
}

export async function createControl(
  organisationId: string,
  payload: ControlPayload,
  auth: ApiAuthContext
) {
  return apiJson<ControlDetail>(`/api/organisations/${organisationId}/controls`, {
    method: "POST",
    auth,
    json: payload,
  });
}

export async function createControlVersion(
  organisationId: string,
  controlId: string,
  payload: ControlPayload,
  auth: ApiAuthContext
) {
  return apiJson<ControlDetail>(
    `/api/organisations/${organisationId}/controls/${controlId}/versions`,
    {
      method: "POST",
      auth,
      json: payload,
    }
  );
}

export async function listControlEvidence(
  organisationId: string,
  controlId: string,
  auth: ApiAuthContext
) {
  return apiJson<EvidenceItem[]>(
    `/api/organisations/${organisationId}/controls/${controlId}/evidence`,
    { auth }
  );
}

export async function linkEvidenceToControl(
  organisationId: string,
  controlId: string,
  evidenceId: string,
  auth: ApiAuthContext
) {
  return apiJson(`/api/organisations/${organisationId}/controls/${controlId}/evidence`, {
    method: "POST",
    auth,
    json: { evidence_item_id: evidenceId },
  });
}
