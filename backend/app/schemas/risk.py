from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RiskCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)
    status: str
    owner_user_id: UUID | None = None


class RiskVersionCreate(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    likelihood: int = Field(..., ge=1, le=5)
    impact: int = Field(..., ge=1, le=5)
    status: str
    owner_user_id: UUID | None = None


class RiskOut(BaseModel):
    risk_id: UUID
    organisation_id: UUID
    latest_version: int
    title: str
    description: str | None
    category: str | None
    likelihood: int
    impact: int
    score: int
    status: str
    owner_user_id: UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RiskVersionOut(BaseModel):
    id: UUID
    organisation_id: UUID
    risk_id: UUID
    version: int
    title: str
    description: str | None
    category: str | None
    likelihood: int
    impact: int
    status: str
    owner_user_id: UUID | None
    created_by_user_id: UUID | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RiskControlLinkCreate(BaseModel):
    control_id: UUID


class RiskControlLinkOut(BaseModel):
    id: UUID
    risk_id: UUID
    control_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
