"""add_rich_metadata_to_export_history

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-08-26 15:00:00.000000

Ajoute les colonnes format, status, files_json, drive_success, drive_errors_json, message
a la table export_history pour persister l'historique detaille des exports.
Compatible SQLite et PostgreSQL Neon.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a1b2"
down_revision: Union[str, None] = "b2c3d4e5f6a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("export_history")]

    # Verification et ajout securise de chaque colonne
    if "format" not in columns:
        op.add_column("export_history", sa.Column("format", sa.String(10), nullable=True, server_default="xlsx"))
    if "status" not in columns:
        op.add_column("export_history", sa.Column("status", sa.String(20), nullable=False, server_default="success"))
    if "files_json" not in columns:
        op.add_column("export_history", sa.Column("files_json", sa.Text(), nullable=True))
    if "drive_success" not in columns:
        op.add_column("export_history", sa.Column("drive_success", sa.Integer(), nullable=True, server_default="0"))
    if "drive_errors_json" not in columns:
        op.add_column("export_history", sa.Column("drive_errors_json", sa.Text(), nullable=True))
    if "message" not in columns:
        op.add_column("export_history", sa.Column("message", sa.Text(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("export_history")]

    for col in ["message", "drive_errors_json", "drive_success", "files_json", "status", "format"]:
        if col in columns:
            op.drop_column("export_history", col)
