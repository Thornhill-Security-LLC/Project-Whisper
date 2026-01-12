from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class IncidentCreate(BaseModel):
    title: str
    description: str | None = None
    severity: str
    status: str
    category: str | None = None
    owner_user_id: UUID | None = None


class IncidentVersionCreate(BaseModel):
    title: str
    description: str | None = None
    severity: str
    status: str
    category: str | None = None
    owner_user_id: UUID | None = None


class IncidentOut(BaseModel):
    incident_id: UUID
    organisation_id: UUID
    latest_version: int
    title: str
    description: str | None
    severity: str
    status: str
    category: str | None
    owner_user_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IncidentVersionOut(BaseModel):
    id: UUID
    organisation_id: UUID
    incident_id: UUID
    version: int
    title: str
    description: str | None
    severity: str
    status: str
    category: str | None
    owner_user_id: UUID | None
    created_by_user_id: UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
