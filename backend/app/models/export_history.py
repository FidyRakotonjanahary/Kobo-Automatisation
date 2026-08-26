from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.base import Base


class ExportHistory(Base):
    __tablename__ = "export_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    form_name: Mapped[str] = mapped_column(String(200))
    pivot_field: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    output_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    account_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("credentials.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    format: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default="xlsx")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success")
    files_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    drive_success: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=0)
    drive_errors_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

