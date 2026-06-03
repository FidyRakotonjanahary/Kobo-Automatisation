"""initial_schema

Revision ID: e69e0119d609
Revises: 
Create Date: 2026-06-03 08:48:28.261416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e69e0119d609'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())

    if 'credentials' not in existing_tables:
        op.create_table('credentials',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('base_url', sa.String(length=255), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('encrypted_password', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )

    if 'export_history' not in existing_tables:
        op.create_table('export_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('form_name', sa.String(length=200), nullable=False),
        sa.Column('pivot_field', sa.String(length=100), nullable=False),
        sa.Column('output_path', sa.String(length=500), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())

    if 'export_history' in existing_tables:
        op.drop_table('export_history')
    if 'credentials' in existing_tables:
        op.drop_table('credentials')
