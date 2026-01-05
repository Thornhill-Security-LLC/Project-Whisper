"""add user_account role

Revision ID: 20250318120000
Revises: 20250313120000
Create Date: 2025-03-18 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250318120000"
down_revision = "20250313120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_account",
        sa.Column(
            "role",
            sa.String(),
            nullable=False,
            server_default=sa.text("'org_member'"),
        ),
    )
    # Bootstrap-created users are not distinguishable yet; default all to org_admin.
    op.execute("UPDATE user_account SET role = 'org_admin'")
    op.alter_column("user_account", "role", server_default=sa.text("'org_member'"))


def downgrade() -> None:
    op.drop_column("user_account", "role")
