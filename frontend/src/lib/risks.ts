import { ApiSession, fetchJson } from "./api";

export interface RiskSummary {
  risk_id: string;
  title?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RiskDetail extends RiskSummary {
  description?: string | null;
  severity?: string | null;
  likelihood?: string | null;
  impact?: string | null;
  owner?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
}

export interface RiskVersion {
  version?: string | number | null;
  created_at?: string | null;
  actor_user_id?: string | null;
  actor_email?: string | null;
  summary?: string | null;
}

export interface RiskPayload {
  title: string;
  description?: string | null;
  severity?: string | null;
  likelihood?: string | null;
  impact?: string | null;
  status?: string | null;
  summary?: string | null;
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
