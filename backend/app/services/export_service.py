import io
import logging
import os
from typing import Dict, List, Mapping, Sequence, Tuple

import pandas as pd
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AppException
from app.models.credential import Credential
from app.repositories.credential_repository import CredentialRepository
from app.schemas.export import (
    AccountFormPair,
    ExportFileResult,
    ExportRequest,
    ExportResult,
    OpenFileResult,
    PreviewResult,
    PreviewSitesResult,
)
from app.services.export_engine import ExportEngine
from app.services.google_service import GoogleService
from app.services.kobo_service import KoboService
from app.utils.normalizer import TextNormalizer
from app.utils.text_encoding import repair_dataframe_columns

logger = logging.getLogger("export_service")


def resolve_csv_encoding(separator: str, encoding: str) -> str:
    normalized = (encoding or "utf-8-sig").lower().replace("_", "-")
    if separator == ";" and normalized == "utf-8":
        return "utf-8-sig"
    return encoding or "utf-8-sig"


async def resolve_credential_pairs(
    repo: CredentialRepository,
    account_forms: List[AccountFormPair],
) -> List[Tuple[Credential, str]]:
    cred_uid_pairs = []
    for af in account_forms:
        # Future auth hook: make get_account tenant-aware before accepting it.
        acc = await repo.get_account(af.account_id)
        if not acc:
            raise HTTPException(404, f"Compte Kobo introuvable: {af.account_id}")
        cred_uid_pairs.append((acc, af.form_uid))
    return cred_uid_pairs


class ExportService:
    def __init__(self, db: AsyncSession):
        self.credential_repository = CredentialRepository(db)

    async def run_export(self, req: ExportRequest) -> ExportResult:
        cred_uid_pairs = await resolve_credential_pairs(
            self.credential_repository,
            req.account_forms,
        )

        try:
            engine = ExportEngine()
            csv_params = self._csv_params(req)

            if len(cred_uid_pairs) == 1:
                cred, uid = cred_uid_pairs[0]
                excel_data = await KoboService.fetch_export_file(cred, uid)
                raw_files = engine.run_pipeline_from_bytes(
                    excel_content=excel_data,
                    form_name=req.form_name,
                    pivot_column=req.pivot_column or "",
                    selected_columns=req.selected_columns,
                    filter_sites=req.filter_sites,
                    selected_sheets=req.selected_sheets,
                    export_format=req.export_format,
                    csv_params=csv_params,
                )
            else:
                merged_dfs = await KoboService.fetch_and_merge_exports_multi(
                    cred_uid_pairs
                )
                raw_files = engine.run_pipeline_from_dfs(
                    merged_dfs=merged_dfs,
                    form_name=req.form_name,
                    pivot_column=req.pivot_column or "",
                    selected_columns=req.selected_columns,
                    filter_sites=req.filter_sites,
                    selected_sheets=req.selected_sheets,
                    export_format=req.export_format,
                    csv_params=csv_params,
                )

            files = self._export_files(raw_files)
            drive_count = self._upload_to_drive(files, req)
            total_rows = sum(file.rows for file in files)

            message = f"Export terminé : {len(files)} fichiers ({total_rows} lignes)."
            return ExportResult(
                status="success",
                message=message,
                files=files,
                drive_success=drive_count,
            )
        except Exception as e:
            logger.error(f"Frayeur export: {e}")
            raise AppException(str(e), 500)

    async def preview_export(self, req: ExportRequest) -> PreviewResult:
        cred_uid_pairs = await resolve_credential_pairs(
            self.credential_repository,
            req.account_forms,
        )

        try:
            dfs = await self._load_export_dataframes(cred_uid_pairs)
            sheet_names = list(dfs.keys())
            if not sheet_names:
                raise ValueError("Le fichier source est vide.")

            # Priorité à l'onglet sélectionné, sinon le premier
            sheet_name = sheet_names[0]
            if req.selected_sheets:
                for target in req.selected_sheets:
                    if target in dfs:
                        sheet_name = target
                        break

            df = repair_dataframe_columns(dfs[sheet_name])
            preview_df = df.head(5)
            buffer = io.StringIO()
            preview_df.to_csv(
                buffer,
                index=False,
                sep=req.csv_separator,
                encoding=resolve_csv_encoding(req.csv_separator, req.csv_encoding),
                quotechar=req.csv_quotechar,
                lineterminator="\r\n",
            )
            return PreviewResult(preview=buffer.getvalue())
        except Exception as e:
            raise AppException(f"Erreur aperçu: {str(e)}", 500)

    async def preview_sites(self, req: ExportRequest) -> PreviewSitesResult:
        cred_uid_pairs = await resolve_credential_pairs(
            self.credential_repository,
            req.account_forms,
        )

        try:
            merged_dfs = await KoboService.fetch_and_merge_exports_multi(cred_uid_pairs)
            sheets = list(merged_dfs.keys())
            if not sheets:
                raise ValueError("Le fichier Excel récupéré est vide.")
            
            # Scanner tous les onglets pour trouver toutes les colonnes possibles
            all_columns_set = set()
            for sheet_df in merged_dfs.values():
                all_columns_set.update([str(c) for c in sheet_df.columns])
            columns = sorted(list(all_columns_set))

            sites = []
            if req.pivot_column:
                target_norm = req.pivot_column.replace("_", " ").strip().lower()
                
                # Chercher la colonne et ses valeurs dans TOUS les onglets
                found_values = set()
                for sheet_df in merged_dfs.values():
                    matched_col = None
                    for col in sheet_df.columns:
                        if str(col).replace("_", " ").strip().lower() == target_norm:
                            matched_col = col
                            break
                    if matched_col:
                        # On normalise CHAQUE valeur avant de l'ajouter au set
                        for v in sheet_df[matched_col].dropna().unique():
                            norm_v = TextNormalizer.normalize(str(v))
                            if norm_v:
                                found_values.add(norm_v)
                
                if found_values:
                    sites = sorted(list(found_values))
            
            return PreviewSitesResult(sites=sites, sheets=sheets, columns=columns)
        except Exception as e:
            logger.error(f"Erreur preview-sites: {e}")
            raise AppException(f"Erreur détection sites: {str(e)}", 500)

    @staticmethod
    def open_export_path(path: str | None) -> OpenFileResult:
        if path and os.path.exists(path):
            os.startfile(path)
            return OpenFileResult(status="success")
        return OpenFileResult(status="error")

    def _csv_params(self, req: ExportRequest) -> Dict[str, str]:
        return {
            "sep": req.csv_separator,
            "encoding": resolve_csv_encoding(req.csv_separator, req.csv_encoding),
            "quotechar": req.csv_quotechar,
        }

    async def _load_export_dataframes(
        self,
        cred_uid_pairs: List[Tuple[Credential, str]],
    ) -> Dict[str, pd.DataFrame]:
        if len(cred_uid_pairs) == 1:
            cred, uid = cred_uid_pairs[0]
            excel_bytes = await KoboService.fetch_export_file(cred, uid)
            return pd.read_excel(io.BytesIO(excel_bytes), sheet_name=None)

        return await KoboService.fetch_and_merge_exports_multi(cred_uid_pairs)

    def _upload_to_drive(
        self, files: List[ExportFileResult], req: ExportRequest
    ) -> int:
        drive_count = 0
        if not req.drive_folder_id:
            return drive_count

        google = GoogleService()
        for file in files:
            try:
                file_name = os.path.basename(file.path)
                google.upload_file(
                    local_path=file.path,
                    folder_id=req.drive_folder_id,
                    display_name=file_name.replace(".xlsx", "").replace(".csv", ""),
                    convert=(req.export_format == "xlsx"),
                )
                drive_count += 1
            except Exception as e:
                logger.error(f"Erreur upload Drive pour {file.site}: {e}")
        return drive_count

    def _export_files(
        self, files: Sequence[Mapping[str, object]]
    ) -> List[ExportFileResult]:
        results = []
        for file in files:
            rows_value = file.get("rows", 0)
            rows = int(rows_value) if rows_value is not None else 0
            file_path = str(file.get("path", ""))
            results.append(
                ExportFileResult(
                    site=str(file.get("site", "")),
                    path=file_path,
                    folder_path=os.path.dirname(file_path),
                    rows=rows,
                )
            )
        return results
