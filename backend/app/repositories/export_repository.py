from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.export_history import ExportHistory


class ExportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_export_history(
        self,
        account_id: Optional[int],
        form_uid: str,
        form_name: str,
        pivot_field: str,
        output_path: str,
    ) -> ExportHistory:
        # form_uid is accepted by the service contract.
        # The current table has no form_uid column yet.
        _ = form_uid
        history = ExportHistory(
            account_id=account_id,
            form_name=form_name,
            pivot_field=pivot_field,
            output_path=output_path,
        )
        self.db.add(history)
        await self.db.commit()
        await self.db.refresh(history)
        return history

    async def get_history_by_account(self, account_id: int) -> List[ExportHistory]:
        result = await self.db.execute(
            select(ExportHistory)
            .where(ExportHistory.account_id == account_id)
            .order_by(ExportHistory.created_at.desc())
        )
        return list(result.scalars().all())
