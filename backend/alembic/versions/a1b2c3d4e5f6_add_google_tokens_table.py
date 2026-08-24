"""add_google_tokens_table

Revision ID: a1b2c3d4e5f6
Revises: 7bf5d11a9da8
Create Date: 2026-08-24 16:00:00.000000

Ajoute la table google_tokens pour stocker le token OAuth2 Google
en base de données plutôt que dans le fichier token.json.
Compatible SQLite (dev) et PostgreSQL (production Render).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "7bf5d11a9da8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "google_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column(
            "token_uri",
            sa.Text(),
            nullable=False,
            server_default="https://oauth2.googleapis.com/token",
        ),
        sa.Column("client_id", sa.Text(), nullable=True),
        sa.Column("client_secret", sa.Text(), nullable=True),
        sa.Column("scopes", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("expiry", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("google_tokens")
