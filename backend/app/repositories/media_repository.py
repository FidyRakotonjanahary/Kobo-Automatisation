import json
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.media_history import MediaHistory


class MediaRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def save_migration_history(
        self,
        source_type: str = "google_sheet",
        source_name: str = "",
        sheet_name: Optional[str] = None,
        drive_folder_id: str = "",
        total_items: int = 0,
        success_count: int = 0,
        failed_count: int = 0,
        update_links: bool = True,
        status: str = "success",
        failed_items: Optional[list] = None,
        message: Optional[str] = None,
    ) -> MediaHistory:
        failed_items_json = (
            json.dumps(failed_items or [], ensure_ascii=False)
            if failed_items is not None
            else None
        )

        history = MediaHistory(
            source_type=source_type or "google_sheet",
            source_name=source_name or "",
            sheet_name=sheet_name,
            drive_folder_id=drive_folder_id or "",
            total_items=total_items,
            success_count=success_count,
            failed_count=failed_count,
            update_links=update_links,
            status=status or "success",
            failed_items_json=failed_items_json,
            message=message or "",
        )
        self.db.add(history)
        await self.db.commit()
        await self.db.refresh(history)
        return history

    async def get_all_history(self, limit: int = 50) -> List[MediaHistory]:
        result = await self.db.execute(
            select(MediaHistory)
            .order_by(MediaHistory.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def clear_all_history(self) -> int:
        result = await self.db.execute(delete(MediaHistory))
        await self.db.commit()
        return result.rowcount or 0
