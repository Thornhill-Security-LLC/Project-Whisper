import { ApiSession, fetchJson } from "./api";
import type { ControlSummary } from "./controls";

export interface RiskSummary {
  risk_id: string;
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RiskDetail extends RiskSummary {
  description?: string | null;
  category?: string | null;
  likelihood?: number | null;
  impact?: number | null;
  owner_user_id?: string | null;
}

export interface RiskVersion {
  version?: string | number | null;
  created_at?: string | null;
  created_by_user_id?: string | null;
  title?: string | null;
}

export interface RiskPayload {
  title: string;
  description?: string | null;
  category?: string | null;
  likelihood?: number | null;
  impact?: number | null;
  status?: string | null;
  owner_user_id?: string | null;
}

export async function listRisks(organisationId: string, session: ApiSession) {
  return fetchJson<RiskSummary[]>(`/api/organisations/${organisationId}/risks`, {}, session);
}

export async function getRisk(organisationId: string, riskId: string, session: ApiSession) {
  return fetchJson<RiskDetail>(
    `/api/organisations/${organisationId}/risks/${riskId}`,
    {},
    session
  );
}

export async function listRiskVersions(
  organisationId: string,
  riskId: string,
  session: ApiSession
) {
  return fetchJson<RiskVersion[]>(
    `/api/organisations/${organisationId}/risks/${riskId}/versions`,
    {},
    session
  );
}

export async function createRisk(
  organisationId: string,
  payload: RiskPayload,
  session: ApiSession
) {
  return fetchJson<RiskDetail>(
    `/api/organisations/${organisationId}/risks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    session
  );
}

export async function createRiskVersion(
  organisationId: string,
  riskId: string,
  payload: RiskPayload,
  session: ApiSession
) {
  return fetchJson<RiskDetail>(
    `/api/organisations/${organisationId}/risks/${riskId}/versions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    session
  );
}

export async function listRiskControls(
  organisationId: string,
  riskId: string,
  session: ApiSession
) {
  return fetchJson<ControlSummary[]>(
    `/api/organisations/${organisationId}/risks/${riskId}/controls`,
    {},
    session
  );
}
