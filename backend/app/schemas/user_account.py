from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

UserRole = Literal["org_owner", "org_admin", "org_member", "auditor"]


class UserAccountCreate(BaseModel):
    email: str
    display_name: str | None = None
    role: UserRole | None = None


class UserAccountOut(BaseModel):
    id: UUID
    organisation_id: UUID
    email: str
    display_name: str | None
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
