"""
Script de migration des données locales (SQLite) vers PostgreSQL (Render ou autre).
Exécutez ce script si vous avez déjà des comptes Kobo enregistrés en local
et souhaitez les copier directement vers votre base PostgreSQL en ligne.

Usage :
    python migrate_sqlite_to_pg.py "postgresql://user:password@host/database"
"""
import asyncio
import os
import sys
import json

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import select

# Ajouter le backend au path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.credential import Credential
from app.models.export_history import ExportHistory
from app.models.google_token import GoogleToken
from app.database.session import _build_async_url


async def migrate_data(target_pg_url: str):
    print("🚀 Début de la migration SQLite -> PostgreSQL...")
    
    # 1. Connexion source SQLite
    sqlite_url = "sqlite+aiosqlite:///./kobo_automation.db"
    sqlite_engine = create_async_engine(sqlite_url, echo=False)
    SqliteSession = async_sessionmaker(sqlite_engine, class_=AsyncSession, expire_on_commit=False)

    # 2. Connexion cible PostgreSQL
    pg_async_url = _build_async_url(target_pg_url)
    pg_engine = create_async_engine(pg_async_url, echo=False)
    PgSession = async_sessionmaker(pg_engine, class_=AsyncSession, expire_on_commit=False)

    async with SqliteSession() as s_session, PgSession() as pg_session:
        # A. Comptes Kobo (Credentials)
        res_creds = await s_session.execute(select(Credential))
        creds = list(res_creds.scalars().all())
        print(f"📦 {len(creds)} comptes Kobo trouvés.")
        for c in creds:
            existing = await pg_session.get(Credential, c.id)
            if not existing:
                new_c = Credential(
                    id=c.id,
                    name=c.name,
                    base_url=c.base_url,
                    username=c.username,
                    encrypted_password=c.encrypted_password,
                    created_at=c.created_at
                )
                pg_session.add(new_c)
        await pg_session.commit()
        print("✅ Comptes Kobo synchronisés.")

        # B. Token Google (GoogleToken)
        res_token = await s_session.execute(select(GoogleToken).where(GoogleToken.id == 1))
        t = res_token.scalar_one_or_none()
        if t:
            existing_t = await pg_session.get(GoogleToken, 1)
            if existing_t:
                existing_t.access_token = t.access_token
                existing_t.refresh_token = t.refresh_token
                existing_t.client_id = t.client_id
                existing_t.client_secret = t.client_secret
                existing_t.scopes = t.scopes
                existing_t.email = t.email
                existing_t.expiry = t.expiry
            else:
                new_t = GoogleToken(
                    id=1,
                    access_token=t.access_token,
                    refresh_token=t.refresh_token,
                    token_uri=t.token_uri,
                    client_id=t.client_id,
                    client_secret=t.client_secret,
                    scopes=t.scopes,
                    email=t.email,
                    expiry=t.expiry,
                )
                pg_session.add(new_t)
            await pg_session.commit()
            print(f"✅ Token Google ({t.email}) synchronisé.")
        else:
            print("ℹ️ Aucun token Google en local à synchroniser.")

    await sqlite_engine.dispose()
    await pg_engine.dispose()
    print("🎉 Migration terminée avec succès !")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Veuillez fournir l'URL PostgreSQL cible.")
        print("Exemple : python migrate_sqlite_to_pg.py postgresql://user:pass@host/dbname")
        sys.exit(1)
    
    target_url = sys.argv[1]
    asyncio.run(migrate_data(target_url))
