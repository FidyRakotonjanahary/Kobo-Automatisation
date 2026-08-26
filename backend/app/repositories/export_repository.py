import json
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.export_history import ExportHistory


class ExportRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_export_history(
        self,
        account_id: Optional[int] = None,
        form_name: str = "",
        pivot_field: Optional[str] = None,
        output_path: Optional[str] = None,
        export_format: str = "xlsx",
        status: str = "success",
        files: Optional[list] = None,
        drive_success: int = 0,
        drive_errors: Optional[list] = None,
        message: Optional[str] = None,
    ) -> ExportHistory:
        files_json = json.dumps(files or [], ensure_ascii=False) if files is not None else None
        drive_errors_json = json.dumps(drive_errors or [], ensure_ascii=False) if drive_errors is not None else None

        history = ExportHistory(
            account_id=account_id,
            form_name=form_name,
            pivot_field=pivot_field or "",
            output_path=output_path or "",
            format=export_format or "xlsx",
            status=status or "success",
            files_json=files_json,
            drive_success=drive_success,
            drive_errors_json=drive_errors_json,
            message=message or "",
        )
        self.db.add(history)
        await self.db.commit()
        await self.db.refresh(history)
        return history

    async def get_all_history(self, limit: int = 50) -> List[ExportHistory]:
        result = await self.db.execute(
            select(ExportHistory)
            .order_by(ExportHistory.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_history_by_account(self, account_id: int, limit: int = 50) -> List[ExportHistory]:
        result = await self.db.execute(
            select(ExportHistory)
            .where(ExportHistory.account_id == account_id)
            .order_by(ExportHistory.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def clear_all_history(self) -> int:
        result = await self.db.execute(delete(ExportHistory))
        await self.db.commit()
        return result.rowcount or 0

