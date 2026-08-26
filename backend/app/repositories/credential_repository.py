from typing import List, Optional

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.security import security_manager
from app.models.credential import Credential
from app.models.export_history import ExportHistory
from app.schemas.kobo import KoboAccountCreate, KoboAccountUpdate


class CredentialRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_account(self, account: KoboAccountCreate) -> Credential:
        encrypted_pass = security_manager.encrypt(account.password)
        db_account = Credential(
            name=account.name,
            base_url=account.base_url,
            username=account.username,
            encrypted_password=encrypted_pass,
        )
        self.db.add(db_account)
        await self.db.commit()
        await self.db.refresh(db_account)
        return db_account

    async def get_accounts(self) -> List[Credential]:
        result = await self.db.execute(select(Credential))
        return list(result.scalars().all())

    async def get_account(self, account_id: int) -> Optional[Credential]:
        result = await self.db.execute(
            select(Credential).filter(Credential.id == account_id)
        )
        return result.scalar_one_or_none()

    async def update_account(
        self, account_id: int, data: KoboAccountUpdate
    ) -> Optional[Credential]:
        account = await self.get_account(account_id)
        if not account:
            return None
        if data.name is not None and data.name.strip():
            account.name = data.name.strip()
        if data.base_url is not None and data.base_url.strip():
            account.base_url = data.base_url.strip()
        if data.username is not None and data.username.strip():
            account.username = data.username.strip()
        if data.password is not None and data.password.strip():
            account.encrypted_password = security_manager.encrypt(data.password.strip())
        await self.db.commit()
        await self.db.refresh(account)
        return account

    async def delete_by_id(self, account_id: int) -> bool:
        account = await self.get_account(account_id)
        if not account:
            return False

        await self.db.execute(
            update(ExportHistory)
            .where(ExportHistory.account_id == account_id)
            .values(account_id=None)
        )
        await self.db.delete(account)
        await self.db.commit()
        return True
