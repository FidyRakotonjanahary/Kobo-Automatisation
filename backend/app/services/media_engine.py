import logging
import os
from typing import List, Optional

from app.core.exceptions import AppException
from app.models.credential import Credential
from app.services.google_service import GoogleService
from app.services.kobo_service import KoboService

logger = logging.getLogger("media_engine")


class MediaEngine:
    def __init__(self, google_service: GoogleService, kobo_accounts: List[Credential]):
        self.google = google_service
        self.kobo_accounts = kobo_accounts
        self.temp_dir = "temp_media"
        os.makedirs(self.temp_dir, exist_ok=True)

    async def pre_flight_check(self, spreadsheet_id: str, drive_folder_id: str):
        """Vérifie l'accès aux ressources avant de commencer."""
        try:
            # Tester l'accès au Sheet (on demande spreadsheetId car 'id' n'existe pas en tant que champ racine)
            self.google.sheets.spreadsheets().get(
                spreadsheetId=spreadsheet_id, fields="spreadsheetId"
            ).execute()
            # Tester l'accès au dossier Drive
            self.google.drive.files().get(fileId=drive_folder_id, fields="id").execute()
        except Exception as e:
            logger.error(f"Pre-flight check failed: {e}")
            # On relaie l'erreur brute pour savoir pourquoi ça bloque
            raise AppException(
                f"Accès Google refusé : {str(e)}",
                403,
            )

    async def migrate_sheet(
        self,
        spreadsheet_id: str,
        sheet_name: Optional[str],
        drive_folder_id: str,
        sheet_folder_mapping: Optional[dict] = None,
        on_progress: Optional[callable] = None,
        check_stop: Optional[callable] = None,
    ):
        def report(msg):
            logger.info(msg)
            if on_progress:
                on_progress(msg)

        await self.pre_flight_check(spreadsheet_id, drive_folder_id)

        try:
            report("🔍 Analyse du fichier Google Sheet...")
            ss_metadata = (
                self.google.sheets.spreadsheets()
                .get(spreadsheetId=spreadsheet_id)
                .execute()
            )
            all_sheets = [
                s["properties"]["title"] for s in ss_metadata.get("sheets", [])
            ]

            if sheet_name and sheet_name.strip():
                if sheet_name in all_sheets:
                    target_sheets = [sheet_name]
                else:
                    raise AppException(f"L'onglet '{sheet_name}' n'existe pas.", 404)
            else:
                target_sheets = all_sheets
                report(f"📜 Parcours de {len(target_sheets)} onglets...")
        except AppException:
            raise
        except Exception as e:
            report(f"❌ Erreur métadonnées: {e}")
            raise AppException("Erreur lors de la lecture du Google Sheet.", 500)

        global_stats = {"success": 0, "failed": 0}
        for s_name in target_sheets:
            report(f"📂 Traitement de l'onglet: {s_name}")
            if check_stop and check_stop():
                report("🛑 Migration arrêtée par l'utilisateur.")
                break
            
            # Utiliser le dossier spécifique si fourni, sinon le dossier par défaut
            target_folder = drive_folder_id
            if sheet_folder_mapping and s_name in sheet_folder_mapping:
                target_folder = sheet_folder_mapping[s_name]
                report(f"📁 Dossier spécifique détecté pour '{s_name}' : {target_folder}")

            sheet_stats = await self._migrate_single_tab(
                spreadsheet_id, s_name, target_folder, on_progress, check_stop
            )
            global_stats["success"] += sheet_stats["success"]
            global_stats["failed"] += sheet_stats["failed"]
        return global_stats

    async def _migrate_single_tab(
        self,
        spreadsheet_id: str,
        sheet_name: str,
        drive_folder_id: str,
        on_progress: Optional[callable] = None,
        check_stop: Optional[callable] = None,
    ):
        def report(msg):
            logger.info(msg)
            if on_progress:
                on_progress(msg)

        try:
            rows = self.google.get_sheet_data(spreadsheet_id, f"'{sheet_name}'!A:ZZ")
        except Exception as e:
            report(f"⚠️ Impossible de lire l'onglet '{sheet_name}': {e}")
            return {"success": 0, "failed": 0}

        if not rows:
            return {"success": 0, "failed": 0}

        headers = rows[0]
        data_rows = rows[1:]
        # Détection intelligente : Titres + Contenu
        keywords = ["_url", "photo", "image", "lien", "media", "file"]
        url_cols = [i for i, h in enumerate(headers) if any(kw in str(h).lower() for kw in keywords)]

        if not url_cols and data_rows:
            for i in range(len(headers)):
                for r in data_rows[:10]:
                    val = str(r[i]) if i < len(r) else ""
                    if "kobotoolbox.org" in val or "/attachment/" in val:
                        url_cols.append(i)
                        break
        stats = {"success": 0, "failed": 0}

        if not url_cols:
            report(f"ℹ️ Aucun champ photo reconnu. Champs scannés : {headers}")
            return stats

        report(f"🖼️ {len(data_rows)} lignes à scanner...")

        for row_idx, row in enumerate(data_rows):
            real_row_idx = row_idx + 2
            for col_idx in url_cols:
                url = str(row[col_idx]) if col_idx < len(row) else ""

                # REPRISE APRÈS ÉCHEC : On ignore si c'est déjà un lien Drive
                if not url or not url.startswith("http") or "drive.google.com" in url:
                    continue

                display_name = f"row_{real_row_idx}_{col_idx}.jpg"
                if col_idx > 0 and col_idx - 1 < len(row):
                    custom_name = str(row[col_idx - 1]).strip()
                    if custom_name and custom_name != "None":
                        display_name = f"{custom_name}.jpg"

                if check_stop and check_stop():
                    report("🛑 Interruption demandée...")
                    break

                report(f"⬇️ En cours : Ligne {real_row_idx}...")
                local_path = os.path.join(
                    self.temp_dir, f"temp_{real_row_idx}_{col_idx}.jpg"
                )

                # Téléchargement via KoboService avec retries automatiques
                download_success = await self._kobo_download_retry(url, local_path)

                if download_success:
                    try:
                        drive_link = self.google.upload_file(
                            local_path, drive_folder_id, display_name
                        )
                        col_letter = self._get_column_letter(col_idx + 1)
                        range_at = f"'{sheet_name}'!{col_letter}{real_row_idx}"
                        self.google.update_cell(spreadsheet_id, range_at, drive_link)
                        stats["success"] += 1
                        report(f"✅ Ligne {real_row_idx} [Col {col_letter}] migrée vers Drive")
                    except Exception:
                        report(f"❌ Erreur Drive (L{real_row_idx})")
                        stats["failed"] += 1
                    finally:
                        if os.path.exists(local_path):
                            try:
                                os.remove(local_path)
                            except Exception:
                                pass
                else:
                    report(f"⚠️ Échec Kobo (L{real_row_idx})")
                    stats["failed"] += 1
        return stats

    async def _kobo_download_retry(self, url: str, path: str) -> bool:
        for acc in self.kobo_accounts:
            try:
                success = await KoboService.download_media_file(acc, url, path)
                if success:
                    return True
            except Exception:
                continue
        return False

    @staticmethod
    def _get_column_letter(n):
        result = ""
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            result = chr(65 + remainder) + result
        return result
