from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserAccountCreate(BaseModel):
    email: str
    display_name: str | None = None


class UserAccountOut(BaseModel):
    id: UUID
    organisation_id: UUID
    email: str
    display_name: str | None
    created_at: datetime

    class Config:
        orm_mode = True
