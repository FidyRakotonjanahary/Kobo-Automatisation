from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import get_db
from app.repositories.credential_repository import CredentialRepository
from app.schemas.kobo import KoboAccountCreate, KoboAccountRead, KoboFormRead
from app.services.kobo_service import KoboService

router = APIRouter()


async def get_account_or_404(repo: CredentialRepository, account_id: int):
    # Future auth hook: filter by current user/tenant before returning it.
    acc = await repo.get_account(account_id)
    if not acc:
        raise HTTPException(404, "Compte non trouvé")
    return acc


@router.post("/accounts", response_model=KoboAccountRead)
async def add_account(account: KoboAccountCreate, db: AsyncSession = Depends(get_db)):
    repo = CredentialRepository(db)
    return await repo.create_account(account)


@router.get("/accounts", response_model=List[KoboAccountRead])
async def list_accounts(db: AsyncSession = Depends(get_db)):
    repo = CredentialRepository(db)
    return await repo.get_accounts()


@router.get("/test/{account_id}")
async def test_kobo_connection(
    account_id: int = Path(..., gt=0), db: AsyncSession = Depends(get_db)
):
    repo = CredentialRepository(db)
    acc = await get_account_or_404(repo, account_id)

    success = await KoboService.test_connection(acc)
    return {"status": "success" if success else "failed"}


@router.get("/forms/{account_id}", response_model=List[KoboFormRead])
async def get_kobo_forms(
    account_id: int = Path(..., gt=0), db: AsyncSession = Depends(get_db)
):
    repo = CredentialRepository(db)
    acc = await get_account_or_404(repo, account_id)

    try:
        return await KoboService.list_forms(acc)
    except Exception as e:
        raise HTTPException(500, f"Erreur Kobo: {str(e)}")


@router.get("/structure/{account_id}/{form_uid}")
async def get_form_structure(
    account_id: int = Path(..., gt=0),
    form_uid: str = Path(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """
    Récupère la structure complète du formulaire (onglets + colonnes).
    Permet de pré-remplir les sélecteurs sans attendre un export complet.
    """
    repo = CredentialRepository(db)
    acc = await get_account_or_404(repo, account_id)

    try:
        structure = await KoboService.get_form_structure(acc, form_uid)
        return structure
    except Exception as e:
        raise HTTPException(500, f"Erreur structure: {str(e)}")


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(
    account_id: int = Path(..., gt=0), db: AsyncSession = Depends(get_db)
):
    repo = CredentialRepository(db)
    deleted = await repo.delete_by_id(account_id)
    if not deleted:
        raise HTTPException(404, "Compte non trouvé")
