"""add_media_history_table

Revision ID: d4e5f6a1b2c3
Revises: c3d4e5f6a1b2
Create Date: 2026-08-26 16:45:00.000000

Ajoute la table media_history pour persister l'historique des migrations de photos Kobo vers Google Drive.
Compatible SQLite et PostgreSQL Neon.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a1b2c3"
down_revision: Union[str, None] = "c3d4e5f6a1b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "media_history" not in tables:
        op.create_table(
            "media_history",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("source_type", sa.String(length=50), nullable=False, server_default="google_sheet"),
            sa.Column("source_name", sa.String(length=500), nullable=False),
            sa.Column("sheet_name", sa.String(length=200), nullable=True),
            sa.Column("drive_folder_id", sa.String(length=500), nullable=False),
            sa.Column("total_items", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("success_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("failed_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("update_links", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="success"),
            sa.Column("failed_items_json", sa.Text(), nullable=True),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "media_history" in tables:
        op.drop_table("media_history")
