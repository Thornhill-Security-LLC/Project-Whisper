from pydantic import BaseModel

from app.schemas.organisation import OrganisationOut
from app.schemas.user_account import UserAccountOut


class BootstrapCreate(BaseModel):
    organisation_name: str
    admin_email: str
    admin_display_name: str | None = None


class BootstrapOut(BaseModel):
    organisation: OrganisationOut
    admin_user: UserAccountOut
