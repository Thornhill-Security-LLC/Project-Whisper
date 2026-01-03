"""add control and evidence tables

Revision ID: 20250312120000
Revises: 20250307120000
Create Date: 2025-03-12 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20250312120000"
down_revision = "20250307120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "control",
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
    op.create_index(
        "ix_control_organisation_id", "control", ["organisation_id"]
    )
    op.create_index("ix_control_created_at", "control", ["created_at"])

    op.create_table(
        "control_version",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "control_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("control.id"),
            nullable=False,
        ),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisation.id"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("control_code", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("framework", sa.Text(), nullable=True),
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
        sa.UniqueConstraint(
            "control_id",
            "version",
            name="uq_control_version_control_id_version",
        ),
    )
    op.create_index(
        "ix_control_version_organisation_id_created_at",
        "control_version",
        ["organisation_id", "created_at"],
    )
    op.create_index(
        "ix_control_version_control_id_version_desc",
        "control_version",
        ["control_id", sa.text("version DESC")],
    )

    op.create_table(
        "evidence_item",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisation.id"),
            nullable=False,
        ),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("evidence_type", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("external_uri", sa.Text(), nullable=True),
        sa.Column("sha256", sa.Text(), nullable=True),
        sa.Column("content_type", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
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
    )
    op.create_index(
        "ix_evidence_item_organisation_id",
        "evidence_item",
        ["organisation_id"],
    )
    op.create_index(
        "ix_evidence_item_created_at", "evidence_item", ["created_at"]
    )
    op.create_index(
        "ix_evidence_item_evidence_type",
        "evidence_item",
        ["evidence_type"],
    )

    op.create_table(
        "control_evidence_link",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organisation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organisation.id"),
            nullable=False,
        ),
        sa.Column(
            "control_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("control.id"),
            nullable=False,
        ),
        sa.Column(
            "evidence_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("evidence_item.id"),
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
            "control_id",
            "evidence_item_id",
            name="uq_control_evidence_link_control_id_evidence_item_id",
        ),
    )
    op.create_index(
        "ix_control_evidence_link_organisation_id",
        "control_evidence_link",
        ["organisation_id"],
    )
    op.create_index(
        "ix_control_evidence_link_control_id",
        "control_evidence_link",
        ["control_id"],
    )
    op.create_index(
        "ix_control_evidence_link_evidence_item_id",
        "control_evidence_link",
        ["evidence_item_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_control_evidence_link_evidence_item_id",
        table_name="control_evidence_link",
    )
    op.drop_index(
        "ix_control_evidence_link_control_id",
        table_name="control_evidence_link",
    )
    op.drop_index(
        "ix_control_evidence_link_organisation_id",
        table_name="control_evidence_link",
    )
    op.drop_table("control_evidence_link")

    op.drop_index("ix_evidence_item_evidence_type", table_name="evidence_item")
    op.drop_index("ix_evidence_item_created_at", table_name="evidence_item")
    op.drop_index(
        "ix_evidence_item_organisation_id", table_name="evidence_item"
    )
    op.drop_table("evidence_item")

    op.drop_index(
        "ix_control_version_control_id_version_desc",
        table_name="control_version",
    )
    op.drop_index(
        "ix_control_version_organisation_id_created_at",
        table_name="control_version",
    )
    op.drop_table("control_version")

    op.drop_index("ix_control_created_at", table_name="control")
    op.drop_index("ix_control_organisation_id", table_name="control")
    op.drop_table("control")
