from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserAccountCreate(BaseModel):
    email: str
    display_name: str | None = None


class UserAccountOut(BaseModel):
    id: UUID
    organisation_id: UUID
    email: str
    display_name: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
