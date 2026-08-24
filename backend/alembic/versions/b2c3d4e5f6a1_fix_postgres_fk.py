"""fix_sqlite_batch_mode_and_add_google_tokens

Cette migration recrée les tables existantes avec les contraintes correctes
pour PostgreSQL (sans batch_alter_table qui est SQLite-only), et ajoute
la table google_tokens.

IMPORTANT : Cette migration REMPLACE les 3 précédentes pour les nouveaux
déploiements PostgreSQL. Les déploiements SQLite existants continuent
d'utiliser les migrations existantes.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a1"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    bind = op.get_bind()
    return bind.dialect.name == "postgresql"


def upgrade() -> None:
    # Sur PostgreSQL, la FK dans export_history a été créée avec batch_alter_table
    # dans la migration 7bf5d11a9da8 qui ne fonctionne pas en PostgreSQL.
    # On la recrée proprement ici si elle n'existe pas encore.
    if _is_postgres():
        # Vérifier si la colonne account_id existe déjà (migration 7bf5d11a9da8 en SQLite)
        # Sur PostgreSQL, la migration 7bf5d11a9da8 aura échoué silencieusement à cause de
        # render_as_batch=True qui est ignoré sur PostgreSQL. On s'assure que la FK est là.
        conn = op.get_bind()
        inspector = sa.inspect(conn)
        columns = [c["name"] for c in inspector.get_columns("export_history")]
        fks = [fk["name"] for fk in inspector.get_foreign_keys("export_history")]

        if "account_id" not in columns:
            op.add_column(
                "export_history", sa.Column("account_id", sa.Integer(), nullable=True)
            )
            op.create_index(
                "ix_export_history_account_id",
                "export_history",
                ["account_id"],
                unique=False,
            )

        if "fk_export_history_account_id_credentials" not in fks:
            op.create_foreign_key(
                "fk_export_history_account_id_credentials",
                "export_history",
                "credentials",
                ["account_id"],
                ["id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    if _is_postgres():
        op.drop_constraint(
            "fk_export_history_account_id_credentials",
            "export_history",
            type_="foreignkey",
        )
        op.drop_index("ix_export_history_account_id", table_name="export_history")
        op.drop_column("export_history", "account_id")
