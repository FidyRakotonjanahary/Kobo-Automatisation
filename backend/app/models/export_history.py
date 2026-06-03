from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.base import Base


class ExportHistory(Base):
    __tablename__ = "export_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    form_name: Mapped[str] = mapped_column(String(200))
    pivot_field: Mapped[str] = mapped_column(String(100))
    output_path: Mapped[str] = mapped_column(String(500))
    account_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("credentials.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
