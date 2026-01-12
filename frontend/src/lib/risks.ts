import { ApiAuthContext, apiJson } from "./api";
import type { ControlSummary } from "./controls";

export interface RiskSummary {
  risk_id: string;
  title?: string | null;
  status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface RiskDetail extends RiskSummary {
  description?: string | null;
  impact?: number | null;
  likelihood?: number | null;
  category?: string | null;
  owner_user_id?: string | null;
}

export interface RiskVersion {
  id?: string | null;
  organisation_id?: string | null;
  risk_id?: string | null;
  version?: number | string | null;
  title?: string | null;
  description?: string | null;
  impact?: number | null;
  likelihood?: number | null;
  category?: string | null;
  status?: string | null;
  owner_user_id?: string | null;
  created_at?: string | null;
  created_by_user_id?: string | null;
}

export interface RiskPayload {
  title: string;
  description?: string | null;
  likelihood?: number | null;
  impact?: number | null;
  status?: string | null;
  category?: string | null;
}

export async function listRisks(organisationId: string, auth: ApiAuthContext) {
  return apiJson<RiskSummary[]>(`/api/organisations/${organisationId}/risks`, { auth });
}

export async function getRisk(organisationId: string, riskId: string, auth: ApiAuthContext) {
  return apiJson<RiskDetail>(`/api/organisations/${organisationId}/risks/${riskId}`, {
    auth,
  });
}

export async function listRiskVersions(
  organisationId: string,
  riskId: string,
  auth: ApiAuthContext
) {
  return apiJson<RiskVersion[]>(
    `/api/organisations/${organisationId}/risks/${riskId}/versions`,
    { auth }
  );
}

export async function createRisk(
  organisationId: string,
  payload: RiskPayload,
  auth: ApiAuthContext
) {
  return apiJson<RiskDetail>(`/api/organisations/${organisationId}/risks`, {
    method: "POST",
    auth,
    json: payload,
  });
}

export async function createRiskVersion(
  organisationId: string,
  riskId: string,
  payload: RiskPayload,
  auth: ApiAuthContext
) {
  return apiJson<RiskDetail>(
    `/api/organisations/${organisationId}/risks/${riskId}/versions`,
    {
      method: "POST",
      auth,
      json: payload,
    }
  );
}

export async function listRiskControls(
  organisationId: string,
  riskId: string,
  auth: ApiAuthContext
) {
  return apiJson<ControlSummary[]>(
    `/api/organisations/${organisationId}/risks/${riskId}/controls`,
    { auth }
  );
}

export async function linkControlToRisk(
  organisationId: string,
  riskId: string,
  controlId: string,
  auth: ApiAuthContext
) {
  return apiJson(`/api/organisations/${organisationId}/risks/${riskId}/controls`, {
    method: "POST",
    auth,
    json: { control_id: controlId },
  });
}
