from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class OrganisationCreate(BaseModel):
    name: str


class OrganisationOut(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    class Config:
        orm_mode = True
