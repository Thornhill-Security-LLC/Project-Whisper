"""add risk control links

Revision ID: 20250319120000
Revises: 20250318120000
Create Date: 2025-03-19 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20250319120000"
down_revision = "20250318120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "risk_control_link",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisation.id"),
            nullable=False,
        ),
        sa.Column(
            "risk_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("risk.id"),
            nullable=False,
        ),
        sa.Column(
            "control_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("control.id"),
            nullable=False,
        ),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_account.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "risk_id",
            "control_id",
            name="uq_risk_control_link_risk_id_control_id",
        ),
    )
    op.create_index(
        "ix_risk_control_link_organisation_id",
        "risk_control_link",
        ["organisation_id"],
    )
    op.create_index(
        "ix_risk_control_link_risk_id",
        "risk_control_link",
        ["risk_id"],
    )
    op.create_index(
        "ix_risk_control_link_control_id",
        "risk_control_link",
        ["control_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_risk_control_link_control_id", table_name="risk_control_link"
    )
    op.drop_index(
        "ix_risk_control_link_risk_id", table_name="risk_control_link"
    )
    op.drop_index(
        "ix_risk_control_link_organisation_id", table_name="risk_control_link"
    )
    op.drop_table("risk_control_link")
