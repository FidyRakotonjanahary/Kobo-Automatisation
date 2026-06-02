from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List
from app.models.credential import Credential
from app.schemas.kobo import KoboAccountCreate
from app.core.security import security_manager

class CredentialRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_account(self, account: KoboAccountCreate) -> Credential:
        encrypted_pass = security_manager.encrypt(account.password)
        db_account = Credential(
            name=account.name,
            base_url=account.base_url,
            username=account.username,
            encrypted_password=encrypted_pass
        )
        self.db.add(db_account)
        await self.db.commit()
        await self.db.refresh(db_account)
        return db_account

    async def get_accounts(self) -> List[Credential]:
        result = await self.db.execute(select(Credential))
        return list(result.scalars().all())

    async def get_account(self, account_id: int) -> Optional[Credential]:
        result = await self.db.execute(select(Credential).filter(Credential.id == account_id))
        return result.scalar_one_or_none()
