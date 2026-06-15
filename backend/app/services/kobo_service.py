import io
import logging
from typing import Any, Dict, List, Optional

import httpx
import pandas as pd

from app.core.exceptions import KoboConnectionError
from app.core.security import security_manager
from app.models.credential import Credential
from app.utils.retry import retry_with_backoff
from app.utils.text_encoding import repair_dataframe_columns

logger = logging.getLogger("kobo_service")


class KoboService:
    XLS_EXPORT_PAYLOAD = {
        "type": "xls",
        "lang": "French (fr)",
        "hierarchy_in_labels": False,
        "multiple_select": "summary",
        "fields_from_all_versions": True,
        "include_media_url": True,
        "group_sep": "/",
    }

    @staticmethod
    def _is_downloadable_xls_export(export: Dict[str, Any]) -> bool:
        if not export.get("result"):
            return False

        export_type = export.get("type")
        export_settings = export.get("export_settings") or export.get("data") or {}
        settings_type = (
            export_settings.get("type") if isinstance(export_settings, dict) else None
        )
        return export_type in (None, "xls") or settings_type == "xls"

    @staticmethod
    @retry_with_backoff(retries=2, exceptions=(httpx.HTTPError,))
    async def test_connection(credential: Credential) -> bool:
        password = security_manager.decrypt(credential.encrypted_password)
        try:
            async with httpx.AsyncClient(
                base_url=credential.base_url,
                auth=(credential.username, password),
                timeout=10.0,
            ) as client:
                response = await client.get("/api/v2/assets/?format=json")
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Test connexion échoué: {e}")
            return False

    @staticmethod
    @retry_with_backoff(
        retries=2, exceptions=(httpx.NetworkError, httpx.TimeoutException)
    )
    async def list_forms(credential: Credential) -> List[Dict[str, Any]]:
        password = security_manager.decrypt(credential.encrypted_password)
        try:
            async with httpx.AsyncClient(
                base_url=credential.base_url,
                auth=(credential.username, password),
                timeout=15.0,
            ) as client:
                response = await client.get("/api/v2/assets/?format=json")
                response.raise_for_status()
                data = response.json()
                return [
                    {
                        "uid": item["uid"],
                        "name": item["name"],
                        "asset_type": item["asset_type"],
                        "owner_username": item["owner__username"],
                    }
                    for item in data.get("results", [])
                    if item.get("asset_type") == "survey"
                ]
        except httpx.HTTPError as e:
            raise KoboConnectionError(detail=str(e))

    @staticmethod
    @retry_with_backoff(
        retries=2, exceptions=(httpx.NetworkError, httpx.TimeoutException)
    )
    async def get_form_structure(
        credential: Credential, asset_uid: str
    ) -> Dict[str, Any]:
        """
        Récupère la structure complète: onglets (sheets) et colonnes (columns).
        Indispensable pour l'export CSV car un onglet = un fichier.
        """
        password = security_manager.decrypt(credential.encrypted_password)
        try:
            async with httpx.AsyncClient(
                base_url=credential.base_url,
                auth=(credential.username, password),
                timeout=30.0,
            ) as client:
                res = await client.get(f"/api/v2/assets/{asset_uid}/?format=json")
                res.raise_for_status()
                asset = res.json()

                survey = asset.get("content", {}).get("survey", [])

                # Onglet principal par défaut (limité à 31 chars comme Excel)
                main_sheet_name = asset.get("name", "survey")[:31]
                sheets = [{"name": main_sheet_name, "columns": []}]

                # Pile pour gérer les onglets imbriqués (Repeat Groups)
                sheet_stack = [sheets[0]]

                for field in survey:
                    f_type = field.get("type", "")

                    if f_type == "begin_repeat":
                        new_sheet_name = field.get("name", "repeat")
                        new_sheet = {"name": new_sheet_name, "columns": []}
                        sheets.append(new_sheet)
                        sheet_stack.append(new_sheet)
                        continue

                    if f_type == "end_repeat":
                        if len(sheet_stack) > 1:
                            sheet_stack.pop()
                        continue

                    # Ignorer les types non-données
                    if f_type in (
                        "begin_group",
                        "end_group",
                        "note",
                        "calculate",
                        "hidden",
                    ):
                        continue

                    # Déterminer le nom de la colonne (Label ou Name)
                    col = None
                    label_data = field.get("label")
                    if isinstance(label_data, list) and label_data:
                        col = str(label_data[0]).strip()
                    elif isinstance(label_data, dict):
                        # Priorité au français
                        col = label_data.get("French (fr)") or label_data.get("French") or next(iter(label_data.values()), None)
                    elif isinstance(label_data, str) and label_data.strip():
                        col = label_data.strip()
                    
                    if not col:
                        col = field.get("name") or field.get("$autoname", "")

                    if col:
                        sheet_stack[-1]["columns"].append(col)

                logger.info(
                    "Structure chargée pour %s: %s onglets détectés.",
                    asset_uid,
                    len(sheets),
                )
                return {"sheets": sheets}
        except httpx.HTTPError as e:
            logger.error(f"Erreur structure Kobo {asset_uid}: {e}")
            raise KoboConnectionError(detail=str(e))

    @staticmethod
    @retry_with_backoff(
        retries=2, exceptions=(httpx.NetworkError, httpx.TimeoutException)
    )
    async def fetch_export_file(credential: Credential, asset_uid: str) -> bytes:
        """
        Déclenche toujours un NOUVEL export XLS sur Kobo pour garantir
        des données complètes et à jour, puis attend et télécharge le résultat.
        """
        import asyncio

        password = security_manager.decrypt(credential.encrypted_password)
        async with httpx.AsyncClient(
            base_url=credential.base_url,
            auth=(credential.username, password),
            timeout=120.0,
        ) as client:
            # 1. Tenter avec le français, sinon fallback sur la langue par défaut
            logger.info(f"Déclenchement d'un nouvel export XLS pour {asset_uid}")
            try:
                post_res = await client.post(
                    f"/api/v2/assets/{asset_uid}/exports/",
                    json=KoboService.XLS_EXPORT_PAYLOAD,
                )
                post_res.raise_for_status()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 400:
                    logger.warning("Langue 'French (fr)' non trouvée, fallback sur '_default'")
                    payload = KoboService.XLS_EXPORT_PAYLOAD.copy()
                    payload["lang"] = "_default"
                    post_res = await client.post(
                        f"/api/v2/assets/{asset_uid}/exports/",
                        json=payload,
                    )
                    post_res.raise_for_status()
                else:
                    raise e
            
            new_export_url = post_res.json().get("url", "")

            # 2. Polling : attendre que l'export soit prêt (max 90s)
            file_url = None
            for _ in range(18):  # 18 * 5s = 90s
                await asyncio.sleep(5)
                if new_export_url:
                    # Vérifier l'état de CE nouvel export précisément
                    check_res = await client.get(new_export_url)
                    check_data = check_res.json()
                    if check_data.get("result"):
                        file_url = check_data["result"]
                        break
                else:
                    # Fallback : prendre le plus récent dans la liste
                    check_res = await client.get(f"/api/v2/assets/{asset_uid}/exports/")
                    checks = check_res.json().get("results", [])
                    checks.sort(key=lambda x: x.get("date_created", ""), reverse=True)
                    if checks and checks[0].get("result"):
                        file_url = checks[0]["result"]
                        break

            if not file_url:
                raise Exception(
                    "L'export Kobo prend trop de temps ou a échoué. "
                    "Réessayez dans une minute."
                )

            # 3. Téléchargement du binaire
            logger.info(f"Téléchargement de l'export frais pour {asset_uid}")
            file_res = await client.get(file_url)
            file_res.raise_for_status()
            return file_res.content

    @staticmethod
    def _deduplicate_export_sheet(df: pd.DataFrame) -> pd.DataFrame:
        key_candidates = [
            ["_uuid"],
            ["_submission__uuid", "_index"],
            ["_submission_uuid", "_index"],
            ["_parent_index", "_index"],
            ["_submission__id", "_index"],
            ["_submission_id", "_index"],
            ["_index"],
        ]
        for keys in key_candidates:
            if all(key in df.columns for key in keys):
                if df[keys].notna().any(axis=1).any():
                    return df.drop_duplicates(subset=keys, keep="first")
        return df

    @staticmethod
    async def fetch_and_merge_exports_multi(
        cred_uid_pairs: list, sheet_name: Optional[Any] = None
    ) -> Dict[str, pd.DataFrame]:
        all_sheets: Dict[str, List[pd.DataFrame]] = {}
        for cred, uid in cred_uid_pairs:
            try:
                excel_bytes = await KoboService.fetch_export_file(cred, uid)
                dfs = pd.read_excel(io.BytesIO(excel_bytes), sheet_name=sheet_name)
                if sheet_name is not None:
                    name = str(sheet_name)
                    if name not in all_sheets:
                        all_sheets[name] = []
                    all_sheets[name].append(dfs)
                else:
                    for name, df in dfs.items():
                        if name not in all_sheets:
                            all_sheets[name] = []
                        all_sheets[name].append(df)
            except Exception as e:
                logger.warning(f"Compte '{cred.username}' (uid={uid}) ignoré: {e}")
                continue
        if not all_sheets:
            raise KoboConnectionError(detail="Aucun compte n'a pu être synchronisé.")

        merged: Dict[str, pd.DataFrame] = {}
        for name, df_list in all_sheets.items():
            combined = pd.concat(df_list, ignore_index=True)
            combined = KoboService._deduplicate_export_sheet(combined)
            merged[name] = repair_dataframe_columns(combined)
        return merged

    @staticmethod
    @retry_with_backoff(
        retries=3, exceptions=(httpx.NetworkError, httpx.TimeoutException)
    )
    async def download_media_file(
        credential: Credential, url: str, target_path: str
    ) -> bool:
        password = security_manager.decrypt(credential.encrypted_password)
        try:
            async with httpx.AsyncClient(
                auth=(credential.username, password), timeout=60.0
            ) as client:
                async with client.stream("GET", url) as response:
                    if response.status_code == 200:
                        with open(target_path, "wb") as f:
                            async for chunk in response.aiter_bytes():
                                f.write(chunk)
                        return True
            return False
        except Exception as e:
            logger.error(f"Erreur download media: {e}")
            return False
