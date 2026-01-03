"""add evidence file storage fields

Revision ID: 20250313120000
Revises: 20250312120000
Create Date: 2025-03-13 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20250313120000"
down_revision = "20250312120000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "evidence_item",
        sa.Column("storage_backend", sa.Text(), nullable=True),
    )
    op.add_column(
        "evidence_item",
        sa.Column("object_key", sa.Text(), nullable=True),
    )
    op.add_column(
        "evidence_item",
        sa.Column("original_filename", sa.Text(), nullable=True),
    )
    op.add_column(
        "evidence_item",
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_evidence_item_organisation_id_created_at",
        "evidence_item",
        ["organisation_id", "created_at"],
    )
    op.create_index(
        "ix_evidence_item_sha256",
        "evidence_item",
        ["sha256"],
    )


def downgrade() -> None:
    op.drop_index("ix_evidence_item_sha256", table_name="evidence_item")
    op.drop_index(
        "ix_evidence_item_organisation_id_created_at",
        table_name="evidence_item",
    )
    op.drop_column("evidence_item", "uploaded_at")
    op.drop_column("evidence_item", "original_filename")
    op.drop_column("evidence_item", "object_key")
    op.drop_column("evidence_item", "storage_backend")
