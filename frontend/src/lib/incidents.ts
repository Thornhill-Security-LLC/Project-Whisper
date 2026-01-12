import { ApiAuthContext, apiJson } from "./api";

export interface IncidentSummary {
  incident_id: string;
  title?: string | null;
  severity?: string | null;
  status?: string | null;
  latest_version?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export interface IncidentDetail extends IncidentSummary {
  description?: string | null;
  category?: string | null;
  owner_user_id?: string | null;
}

export interface IncidentVersion {
  id?: string | null;
  organisation_id?: string | null;
  incident_id?: string | null;
  version?: number | string | null;
  title?: string | null;
  description?: string | null;
  severity?: string | null;
  status?: string | null;
  category?: string | null;
  owner_user_id?: string | null;
  created_at?: string | null;
  created_by_user_id?: string | null;
}

export interface IncidentPayload {
  title: string;
  description?: string | null;
  severity?: string | null;
  status?: string | null;
  category?: string | null;
  owner_user_id?: string | null;
}

export async function listIncidents(organisationId: string, auth: ApiAuthContext) {
  return apiJson<IncidentSummary[]>(`/api/organisations/${organisationId}/incidents`, { auth });
}

export async function getIncident(
  organisationId: string,
  incidentId: string,
  auth: ApiAuthContext
) {
  return apiJson<IncidentDetail>(
    `/api/organisations/${organisationId}/incidents/${incidentId}`,
    {
      auth,
    }
  );
}

export async function listIncidentVersions(
  organisationId: string,
  incidentId: string,
  auth: ApiAuthContext
) {
  return apiJson<IncidentVersion[]>(
    `/api/organisations/${organisationId}/incidents/${incidentId}/versions`,
    { auth }
  );
}

export async function createIncident(
  organisationId: string,
  payload: IncidentPayload,
  auth: ApiAuthContext
) {
  return apiJson<IncidentDetail>(`/api/organisations/${organisationId}/incidents`, {
    method: "POST",
    auth,
    json: payload,
  });
}

export async function createIncidentVersion(
  organisationId: string,
  incidentId: string,
  payload: IncidentPayload,
  auth: ApiAuthContext
) {
  return apiJson<IncidentDetail>(
    `/api/organisations/${organisationId}/incidents/${incidentId}/versions`,
    {
      method: "POST",
      auth,
      json: payload,
    }
  );
}
