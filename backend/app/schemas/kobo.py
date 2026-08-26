from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class KoboAccountCreate(BaseModel):
    name: str
    base_url: str = "https://kf.kobotoolbox.org"
    username: str
    password: str


class KoboAccountRead(BaseModel):
    id: int
    name: str
    username: str
    base_url: str
    created_at: datetime

    class Config:
        from_attributes = True


class KoboFormRead(BaseModel):
    uid: str
    name: str
    asset_type: str
    owner_username: str
    submissions_count: int = 0
    date_modified: Optional[str] = None
    has_deployment: bool = True
