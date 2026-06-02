from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.database.base import Base
from datetime import datetime

class ExportHistory(Base):
    __tablename__ = "export_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    form_name: Mapped[str] = mapped_column(String(200))
    pivot_field: Mapped[str] = mapped_column(String(100))
    output_path: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
