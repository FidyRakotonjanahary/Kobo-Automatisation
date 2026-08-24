from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.base import Base


class GoogleToken(Base):
    """
    Stocke le token OAuth2 Google en base de données.
    Remplace le fichier token.json sur le système de fichiers.
    Une seule ligne est attendue (id=1) ; les mises à jour écrasent cette ligne.
    """

    __tablename__ = "google_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_uri: Mapped[str] = mapped_column(
        Text, default="https://oauth2.googleapis.com/token"
    )
    client_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_secret: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scopes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list as string
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expiry: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # ISO datetime string
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
