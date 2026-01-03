"""add risk tables

Revision ID: 20250307120000
Revises: 20250213120000
Create Date: 2025-03-07 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20250307120000"
down_revision = "20250213120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "risk",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisation.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_risk_organisation_id", "risk", ["organisation_id"])
    op.create_index("ix_risk_created_at", "risk", ["created_at"])

    op.create_table(
        "risk_version",
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
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.Text(), nullable=True),
        sa.Column("likelihood", sa.Integer(), nullable=False),
        sa.Column("impact", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("user_account.id"),
            nullable=True,
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
        sa.CheckConstraint(
            "likelihood BETWEEN 1 AND 5", name="ck_risk_version_likelihood_range"
        ),
        sa.CheckConstraint(
            "impact BETWEEN 1 AND 5", name="ck_risk_version_impact_range"
        ),
        sa.UniqueConstraint("risk_id", "version", name="uq_risk_version_risk_id_version"),
    )
    op.create_index(
        "ix_risk_version_organisation_id_created_at",
        "risk_version",
        ["organisation_id", "created_at"],
    )
    op.create_index(
        "ix_risk_version_risk_id_version_desc",
        "risk_version",
        ["risk_id", sa.text("version DESC")],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_risk_version_risk_id_version_desc", table_name="risk_version"
    )
    op.drop_index(
        "ix_risk_version_organisation_id_created_at", table_name="risk_version"
    )
    op.drop_table("risk_version")

    op.drop_index("ix_risk_created_at", table_name="risk")
    op.drop_index("ix_risk_organisation_id", table_name="risk")
    op.drop_table("risk")
