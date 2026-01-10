import { ApiSession, fetchJson } from "./api";
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
  version?: number | string | null;
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

export async function listControls(organisationId: string, session: ApiSession) {
  return fetchJson<ControlSummary[]>(
    `/api/organisations/${organisationId}/controls`,
    {},
    session
  );
}

export async function getControl(
  organisationId: string,
  controlId: string,
  session: ApiSession
) {
  return fetchJson<ControlDetail>(
    `/api/organisations/${organisationId}/controls/${controlId}`,
    {},
    session
  );
}

export async function listControlVersions(
  organisationId: string,
  controlId: string,
  session: ApiSession
) {
  return fetchJson<ControlVersion[]>(
    `/api/organisations/${organisationId}/controls/${controlId}/versions`,
    {},
    session
  );
}

export async function createControl(
  organisationId: string,
  payload: ControlPayload,
  session: ApiSession
) {
  return fetchJson<ControlDetail>(
    `/api/organisations/${organisationId}/controls`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    session
  );
}

export async function createControlVersion(
  organisationId: string,
  controlId: string,
  payload: ControlPayload,
  session: ApiSession
) {
  return fetchJson<ControlDetail>(
    `/api/organisations/${organisationId}/controls/${controlId}/versions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    session
  );
}

export async function listControlEvidence(
  organisationId: string,
  controlId: string,
  session: ApiSession
) {
  return fetchJson<EvidenceItem[]>(
    `/api/organisations/${organisationId}/controls/${controlId}/evidence`,
    {},
    session
  );
}

export async function linkEvidenceToControl(
  organisationId: string,
  controlId: string,
  evidenceId: string,
  session: ApiSession
) {
  return fetchJson(
    `/api/organisations/${organisationId}/controls/${controlId}/evidence`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence_item_id: evidenceId }),
    },
    session
  );
}
