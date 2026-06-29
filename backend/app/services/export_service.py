import io
import logging
import os
from typing import Dict, List, Mapping, Optional, Sequence, Tuple

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
from app.core.task_monitor import task_monitor
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
        task_id = req.task_id or "legacy"
        task_monitor.start_task(task_id)
        
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
                    task_id=task_id,
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
                    task_id=task_id,
                )

            # Vérification après filtrage (avant upload)
            if task_monitor.is_cancelled(task_id):
                return ExportResult(status="success", message="Exportation annul\u00e9e par l'utilisateur.", files=[], drive_success=0)

            files = self._export_files(raw_files)
            drive_count = self._upload_to_drive(files, req, task_id)
            total_rows = sum(file.rows for file in files)

            message = f"Export termin\u00e9 : {len(files)} fichiers ({total_rows} lignes)."
            return ExportResult(
                status="success",
                message=message,
                files=files,
                drive_success=drive_count,
            )
        except Exception as e:
            logger.error(f"Frayeur export: {e}")
            raise AppException(str(e), 500)
        finally:
            task_monitor.stop_task(task_id)

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
            
            # Liste ordonnée : d'abord l'onglet sélectionné, puis le reste
            # Construction de la liste des colonnes (optimisée par priorité d'onglet)
            all_columns_list = []
            seen_columns = set()
            
            scan_order = sheets
            if req.selected_sheets:
                selected = [s for s in sheets if s in req.selected_sheets]
                others = [s for s in sheets if s not in req.selected_sheets]
                scan_order = selected + others

            for s_name in scan_order:
                sheet_df = merged_dfs[s_name]
                for col in sheet_df.columns:
                    col_str = str(col)
                    if col_str not in seen_columns:
                        if col_str.startswith(('_submission', '_notes', '_tags', '_id', '_uuid')) and len(col_str) > 15:
                            continue
                        all_columns_list.append(col_str)
                        seen_columns.add(col_str)
            
            sites = []
            if req.pivot_column:
                target_norm = req.pivot_column.replace("_", " ").strip().lower()
                found_values = set()
                for sheet_df in merged_dfs.values():
                    matched_col = None
                    for col in sheet_df.columns:
                        if str(col).replace("_", " ").strip().lower() == target_norm:
                            matched_col = col
                            break
                    if matched_col:
                        for v in sheet_df[matched_col].dropna().unique():
                            norm_v = TextNormalizer.normalize(str(v))
                            if norm_v:
                                found_values.add(norm_v)
                if found_values:
                    sites = sorted(list(found_values))
            
            # Identifie l'onglet principal de manière robuste
            # Dans Kobo, c'est l'onglet qui a le plus de colonnes ou celui qui contient 'start/end/_uuid'
            def get_main_sheet_name():
                best_match = sheets[0]
                max_score = -1
                for s in sheets:
                    cols = [str(c).lower() for c in merged_dfs[s].columns]
                    score = 0
                    if 'start' in cols: score += 5
                    if '_uuid' in cols: score += 5
                    if 'deviceid' in cols: score += 5
                    if len(cols) > max_score:
                        max_score = len(cols)
                        best_match = s
                    if score > 10: return s # Match certain
                return best_match

            main_sheet_actual = get_main_sheet_name()
            
            # Tri stable : Principal d'abord, puis les autres
            sorted_sheets = [main_sheet_actual] + [s for s in sheets if s != main_sheet_actual]
            
            return PreviewSitesResult(
                sites=sites, 
                sheets=sorted_sheets, # On renvoie TOUJOURS la liste pour la stabilité de l'UI
                columns=all_columns_list
            )
        except Exception as e:
            logger.error(f"Erreur preview-sites: {e}")
            raise AppException(f"Erreur détection sites: {str(e)}", 500)

    @staticmethod
    def open_export_path(path: str | None) -> OpenFileResult:
        import subprocess, sys
        if not path or not os.path.exists(path):
            return OpenFileResult(status="error")
        try:
            norm_path = os.path.normpath(path)
            if sys.platform == "win32":
                import ctypes
                # Lever la restriction Windows qui empêche de voler le focus
                # ASFW_ANY (-1) = autoriser N'IMPORTE quel processus à mettre sa fenêtre au premier plan
                ctypes.windll.user32.AllowSetForegroundWindow(ctypes.c_uint(-1))
                if os.path.isfile(path):
                    os.startfile(norm_path)
                else:
                    subprocess.Popen(['explorer', norm_path])
            else:
                opener = "open" if sys.platform == "darwin" else "xdg-open"
                subprocess.Popen([opener, path])
            return OpenFileResult(status="success")
        except Exception as e:
            logger.error(f"Erreur ouverture fichier: {e}")
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
        self, files: List[ExportFileResult], req: ExportRequest, task_id: Optional[str] = None
    ) -> int:
        drive_count = 0
        if not req.drive_folder_id:
            return drive_count

        google = GoogleService()
        for file in files:
            # Vérifier l'annulation avant chaque fichier
            if task_id and task_monitor.is_cancelled(task_id):
                logger.warning(f"Upload Drive interrompu pour la t\u00e2che {task_id}")
                break

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
