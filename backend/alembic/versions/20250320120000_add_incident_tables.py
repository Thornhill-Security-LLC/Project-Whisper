"""add incident tables

Revision ID: 20250320120000
Revises: 20250319120000
Create Date: 2025-03-20 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20250320120000"
down_revision = "20250319120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "incident",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisation.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("latest_version", sa.Integer, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_incident_organisation_id", "incident", ["organisation_id"])
    op.create_index("ix_incident_created_at", "incident", ["created_at"])
    op.create_index("ix_incident_updated_at", "incident", ["updated_at"])

    op.create_table(
        "incident_version",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisation.id"),
            nullable=False,
        ),
        sa.Column(
            "incident_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("incident.id"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("severity", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=True),
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
        sa.UniqueConstraint(
            "incident_id",
            "version",
            name="uq_incident_version_incident_id_version",
        ),
    )
    op.create_index(
        "ix_incident_version_organisation_id",
        "incident_version",
        ["organisation_id"],
    )
    op.create_index(
        "ix_incident_version_incident_id",
        "incident_version",
        ["incident_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_incident_version_incident_id", table_name="incident_version"
    )
    op.drop_index(
        "ix_incident_version_organisation_id",
        table_name="incident_version",
    )
    op.drop_table("incident_version")

    op.drop_index("ix_incident_updated_at", table_name="incident")
    op.drop_index("ix_incident_created_at", table_name="incident")
    op.drop_index("ix_incident_organisation_id", table_name="incident")
    op.drop_table("incident")
