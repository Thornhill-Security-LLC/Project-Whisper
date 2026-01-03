from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class EvidenceCreate(BaseModel):
    title: str
    description: str | None = None
    evidence_type: str
    source: str | None = None
    external_uri: str | None = None
    sha256: str | None = None
    content_type: str | None = None
    size_bytes: int | None = None


class EvidenceOut(BaseModel):
    id: UUID
    organisation_id: UUID
    title: str
    description: str | None
    evidence_type: str
    source: str | None
    external_uri: str | None
    sha256: str | None
    content_type: str | None
    size_bytes: int | None
    created_by_user_id: UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
