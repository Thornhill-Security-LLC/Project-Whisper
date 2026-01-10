from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ControlCreate(BaseModel):
    framework: str | None = None
    control_code: str
    title: str
    description: str | None = None
    status: str
    owner_user_id: UUID | None = None


class ControlVersionCreate(BaseModel):
    framework: str | None = None
    control_code: str
    title: str
    description: str | None = None
    status: str
    owner_user_id: UUID | None = None


class ControlOut(BaseModel):
    control_id: UUID
    organisation_id: UUID
    latest_version: int
    framework: str | None
    control_code: str
    title: str
    description: str | None
    status: str
    owner_user_id: UUID | None
    score: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ControlVersionOut(BaseModel):
    id: UUID
    organisation_id: UUID
    control_id: UUID
    version: int
    control_code: str
    title: str
    description: str | None
    framework: str | None
    status: str
    owner_user_id: UUID | None
    created_by_user_id: UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ControlEvidenceLinkCreate(BaseModel):
    evidence_item_id: UUID


class ControlEvidenceLinkOut(BaseModel):
    id: UUID
    control_id: UUID
    evidence_item_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
