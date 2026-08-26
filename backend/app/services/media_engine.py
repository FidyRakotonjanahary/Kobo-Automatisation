import asyncio
import io
import logging
import os
import urllib.parse
from typing import Callable, Dict, List, Optional, Tuple

import openpyxl
import pandas as pd

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
            await self.google.get_sheet_data(spreadsheet_id, "A1:A1")
        except Exception as e:
            logger.error(f"Pre-flight check failed: {e}")
            raise AppException(f"Accès Google refusé : {str(e)}", 403)

    @staticmethod
    def _is_already_migrated_url(url: str) -> bool:
        """Vérifie si une cellule contient déjà un lien Google Drive / Google Docs / UserContent."""
        if not url or not isinstance(url, str):
            return False
        clean = url.lower()
        return any(
            domain in clean
            for domain in (
                "drive.google.com",
                "docs.google.com",
                "lh3.googleusercontent.com",
                "googleusercontent.com",
            )
        )

    # ═══════════════════════════════════════════════════════════════
    #  Migration Google Sheet → Drive
    # ═══════════════════════════════════════════════════════════════

    async def migrate_sheet(
        self,
        spreadsheet_id: str,
        sheet_name: Optional[str],
        drive_folder_id: str,
        sheet_folder_mapping: Optional[dict] = None,
        on_progress: Optional[Callable] = None,
        check_stop: Optional[Callable] = None,
        update_links: bool = True,
        concurrency: int = 5,
    ) -> dict:
        def report(msg, current=None, total=None, current_action="", success=0, failed=0):
            logger.info(msg)
            if on_progress:
                on_progress(msg, current, total, current_action, success, failed)

        await self.pre_flight_check(spreadsheet_id, drive_folder_id)

        # ── Récupérer la liste des onglets via l'API Sheets ──
        try:
            report("🔍 Analyse de la structure du Google Sheet...", current_action="Scan")
            import httpx

            async with httpx.AsyncClient(timeout=30) as client:
                token = await self.google._ensure_token(client)
                res = await client.get(
                    f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}?fields=sheets.properties.title",
                    headers={"Authorization": f"Bearer {token}"},
                )
            if res.status_code != 200:
                raise Exception(f"HTTP {res.status_code}: {res.text[:200]}")
            ss_data = res.json()
            all_sheets = [s["properties"]["title"] for s in ss_data.get("sheets", [])]

            if sheet_name and sheet_name.strip():
                if sheet_name in all_sheets:
                    target_sheets = [sheet_name]
                else:
                    raise AppException(f"L'onglet '{sheet_name}' n'existe pas.", 404)
            else:
                target_sheets = all_sheets
                report(f"📜 Parcours de {len(target_sheets)} onglets...", current_action="Scan")
        except AppException:
            raise
        except Exception as e:
            report(f"❌ Erreur métadonnées: {e}", current_action="Erreur")
            raise AppException("Erreur lors de la lecture du Google Sheet.", 500)

        # ── Pré-scan : compter le nombre total de médias à migrer ──
        report("📊 Scan initial des éléments à migrer...", current_action="Scan")
        sheets_data = {}
        total_items = 0
        already_migrated_count = 0

        for s_name in target_sheets:
            if check_stop and check_stop():
                break

            target_folder = self._resolve_target_folder(
                s_name, sheet_folder_mapping, drive_folder_id
            )
            if not target_folder:
                report(f"⏭️ Onglet '{s_name}' ignoré : aucune destination Drive configurée.")
                continue

            try:
                rows = await self.google.get_sheet_data(spreadsheet_id, f"'{s_name}'!A:ZZ")
                if not rows:
                    continue
                headers = rows[0]
                data_rows = rows[1:]
                keywords = ["_url", "photo", "image", "lien", "media", "file"]
                url_cols = [
                    i
                    for i, h in enumerate(headers)
                    if any(kw in str(h).lower() for kw in keywords)
                ]

                if not url_cols and data_rows:
                    for i in range(len(headers)):
                        for r in data_rows[:10]:
                            val = str(r[i]) if i < len(r) else ""
                            if "kobotoolbox.org" in val or "/attachment/" in val:
                                url_cols.append(i)
                                break

                if not url_cols:
                    continue

                valid_items = []
                for row_idx, r in enumerate(data_rows):
                    real_row = row_idx + 2
                    for col_idx in url_cols:
                        url = str(r[col_idx]) if col_idx < len(r) else ""
                        if url and url.startswith("http"):
                            if self._is_already_migrated_url(url):
                                already_migrated_count += 1
                            else:
                                valid_items.append((real_row, col_idx, url, r))

                if valid_items:
                    sheets_data[s_name] = {
                        "target_folder": target_folder,
                        "headers": headers,
                        "valid_items": valid_items,
                    }
                    total_items += len(valid_items)
            except Exception as e:
                report(f"⚠️ Erreur lors de l'analyse de '{s_name}': {e}")

        if already_migrated_count > 0:
            report(f"ℹ️ {already_migrated_count} photo(s) déjà migrées vers Google Drive ignorées.", current_action="Scan")

        report(
            f"🚀 Scan terminé : {total_items} média(s) en attente de migration (parallèle x{concurrency}).",
            0,
            total_items,
            current_action="Prêt",
        )

        global_stats = {
            "success": 0,
            "failed": 0,
            "skipped_duplicates": 0,
            "failed_items": [],
        }
        current_count = 0
        sem = asyncio.Semaphore(concurrency)
        lock = asyncio.Lock()
        migrated_urls_cache: Dict[str, str] = {}

        for s_name, s_info in sheets_data.items():
            if check_stop and check_stop():
                report(
                    "🛑 Migration arrêtée par l'utilisateur.",
                    current_count,
                    total_items,
                    current_action="Arrêté",
                    success=global_stats["success"],
                    failed=global_stats["failed"],
                )
                break

            target_folder = s_info["target_folder"]
            headers = s_info["headers"]
            valid_items = s_info["valid_items"]

            report(
                f"📂 Traitement de l'onglet : {s_name} ({len(valid_items)} médias)...",
                current_count,
                total_items,
                current_action=f"Onglet {s_name}",
                success=global_stats["success"],
                failed=global_stats["failed"],
            )

            async def worker(item):
                nonlocal current_count
                real_row, col_idx, url, row = item

                if check_stop and check_stop():
                    return

                col_name = str(headers[col_idx]) if col_idx < len(headers) else f"col_{col_idx}"
                col_letter = self._get_column_letter(col_idx + 1)

                # ── Déduplication : URL Kobo déjà migrée dans cette même session ──
                if url in migrated_urls_cache:
                    drive_link = migrated_urls_cache[url]
                    async with lock:
                        current_count += 1
                        c = current_count
                        if update_links:
                            range_at = f"'{s_name}'!{col_letter}{real_row}"
                            try:
                                await self.google.update_cell(spreadsheet_id, range_at, drive_link)
                            except Exception as e:
                                logger.warning(f"Erreur mise à jour cellule dédupliquée L{real_row}: {e}")
                        global_stats["success"] += 1
                        global_stats["skipped_duplicates"] += 1
                        report(
                            f"♻️ [{c}/{total_items}] L{real_row} [Col {col_letter}] : Photo déjà migrée réutilisée (déduplication)",
                            c,
                            total_items,
                            current_action="Déduplication",
                            success=global_stats["success"],
                            failed=global_stats["failed"],
                        )
                    return

                ext = self._extract_file_extension(url)
                display_name = f"row_{real_row}_{col_name}{ext}"

                if col_idx > 0 and col_idx - 1 < len(row):
                    custom_name = str(row[col_idx - 1]).strip()
                    if custom_name and custom_name not in ("nan", "None"):
                        if any(
                            custom_name.lower().endswith(e)
                            for e in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".mp4"]
                        ):
                            display_name = custom_name
                        else:
                            display_name = f"{custom_name}{ext}"

                async with lock:
                    current_count += 1
                    c = current_count
                    report(
                        f"⬇️ [{c}/{total_items}] L{real_row} : Téléchargement ({display_name})...",
                        c,
                        total_items,
                        current_action="Téléchargement Kobo",
                        success=global_stats["success"],
                        failed=global_stats["failed"],
                    )

                local_path = os.path.join(self.temp_dir, f"temp_{real_row}_{col_idx}_{c}{ext}")

                async with sem:
                    download_success, download_reason = await self._kobo_download_retry(url, local_path)

                if download_success:
                    try:
                        drive_link = await self.google.upload_file(local_path, target_folder, display_name)
                        migrated_urls_cache[url] = drive_link

                        if update_links:
                            range_at = f"'{s_name}'!{col_letter}{real_row}"
                            await self.google.update_cell(spreadsheet_id, range_at, drive_link)

                        async with lock:
                            global_stats["success"] += 1
                            action = "migré" if update_links else "uploadé"
                            report(
                                f"✅ [{c}/{total_items}] L{real_row} [Col {col_letter}] {action} vers Drive",
                                c,
                                total_items,
                                current_action="Upload Drive",
                                success=global_stats["success"],
                                failed=global_stats["failed"],
                            )
                    except Exception as e:
                        async with lock:
                            report(
                                f"❌ [{c}/{total_items}] Erreur Drive (L{real_row}) : {e}",
                                c,
                                total_items,
                                current_action="Erreur Drive",
                                success=global_stats["success"],
                                failed=global_stats["failed"] + 1,
                            )
                            logger.exception(f"Erreur Drive migration ligne {real_row}")
                            global_stats["failed"] += 1
                            global_stats["failed_items"].append({
                                "sheet": s_name,
                                "row": real_row,
                                "col": col_name,
                                "url": url,
                                "reason": f"Erreur Google Drive: {str(e)}",
                            })
                    finally:
                        if os.path.exists(local_path):
                            try:
                                os.remove(local_path)
                            except Exception:
                                pass
                else:
                    async with lock:
                        report(
                            f"⚠️ [{c}/{total_items}] Échec Kobo (L{real_row}) : {download_reason}",
                            c,
                            total_items,
                            current_action="Échec Kobo",
                            success=global_stats["success"],
                            failed=global_stats["failed"] + 1,
                        )
                        global_stats["failed"] += 1
                        global_stats["failed_items"].append({
                            "sheet": s_name,
                            "row": real_row,
                            "col": col_name,
                            "url": url,
                            "reason": download_reason,
                        })

            tasks = [worker(item) for item in valid_items]
            await asyncio.gather(*tasks)

        return global_stats

    # ═══════════════════════════════════════════════════════════════
    #  Migration Excel local → Drive
    # ═══════════════════════════════════════════════════════════════

    async def migrate_excel_file(
        self,
        excel_bytes: bytes,
        drive_folder_id: str,
        sheet_name: Optional[str] = None,
        sheet_folder_mapping: Optional[dict] = None,
        on_progress: Optional[Callable] = None,
        check_stop: Optional[Callable] = None,
        update_links: bool = True,
        concurrency: int = 5,
    ) -> Tuple[Optional[bytes], dict]:
        def report(msg, current=None, total=None, current_action="", success=0, failed=0):
            logger.info(msg)
            if on_progress:
                on_progress(msg, current, total, current_action, success, failed)

        try:
            xls = pd.ExcelFile(io.BytesIO(excel_bytes))
            all_sheet_names = xls.sheet_names
        except Exception as e:
            raise AppException(f"Impossible de lire le fichier Excel : {e}", 400)

        if sheet_name and sheet_name.strip():
            if sheet_name in all_sheet_names:
                target_sheets = [sheet_name]
            else:
                raise AppException(f"L'onglet '{sheet_name}' n'existe pas dans le fichier.", 404)
        else:
            target_sheets = all_sheet_names

        all_dfs = {s: xls.parse(s) for s in all_sheet_names}

        # ── Pré-scan Excel ──
        report("📊 Scan initial du fichier Excel...", current_action="Scan")
        sheets_data = {}
        total_items = 0
        already_migrated_count = 0

        for s_name in target_sheets:
            if check_stop and check_stop():
                break

            target_folder = self._resolve_target_folder(
                s_name, sheet_folder_mapping, drive_folder_id
            )
            if not target_folder:
                report(f"⏭️ Onglet '{s_name}' ignoré : aucune destination Drive configurée.")
                continue

            df = all_dfs[s_name]
            if df.empty:
                continue

            headers = list(df.columns)
            keywords = ["_url", "photo", "image", "lien", "media", "file"]
            url_cols = [
                i
                for i, h in enumerate(headers)
                if any(kw in str(h).lower() for kw in keywords)
            ]

            if not url_cols:
                for i, col in enumerate(headers):
                    for val in df.iloc[:10, i].dropna():
                        sv = str(val)
                        if "kobotoolbox.org" in sv or "/attachment/" in sv:
                            url_cols.append(i)
                            break

            if not url_cols:
                continue

            valid_items = []
            for row_idx in range(len(df)):
                real_row = row_idx + 2
                for col_idx in url_cols:
                    url = str(df.iat[row_idx, col_idx]) if col_idx < len(headers) else ""
                    if url and url not in ("nan", "None") and url.startswith("http"):
                        if self._is_already_migrated_url(url):
                            already_migrated_count += 1
                        else:
                            valid_items.append((row_idx, real_row, col_idx, url))

            if valid_items:
                sheets_data[s_name] = {
                    "target_folder": target_folder,
                    "headers": headers,
                    "valid_items": valid_items,
                }
                total_items += len(valid_items)

        if already_migrated_count > 0:
            report(f"ℹ️ {already_migrated_count} photo(s) déjà migrées vers Google Drive ignorées.", current_action="Scan")

        report(
            f"🚀 Scan Excel terminé : {total_items} média(s) à migrer (parallèle x{concurrency}).",
            0,
            total_items,
            current_action="Prêt",
        )

        global_stats = {
            "success": 0,
            "failed": 0,
            "skipped_duplicates": 0,
            "failed_items": [],
        }
        current_count = 0
        sem = asyncio.Semaphore(concurrency)
        lock = asyncio.Lock()
        migrated_urls_cache: Dict[str, str] = {}

        for s_name, s_info in sheets_data.items():
            if check_stop and check_stop():
                report(
                    "🛑 Migration arrêtée par l'utilisateur.",
                    current_count,
                    total_items,
                    current_action="Arrêté",
                    success=global_stats["success"],
                    failed=global_stats["failed"],
                )
                break

            target_folder = s_info["target_folder"]
            headers = s_info["headers"]
            valid_items = s_info["valid_items"]
            df = all_dfs[s_name]

            report(
                f"📂 Traitement de l'onglet : {s_name} ({len(valid_items)} médias)...",
                current_count,
                total_items,
                current_action=f"Onglet {s_name}",
                success=global_stats["success"],
                failed=global_stats["failed"],
            )

            async def excel_worker(item):
                nonlocal current_count
                row_idx, real_row, col_idx, url = item

                if check_stop and check_stop():
                    return

                col_name = str(headers[col_idx])

                # ── Déduplication : URL Kobo déjà migrée dans cette même session ──
                if url in migrated_urls_cache:
                    drive_link = migrated_urls_cache[url]
                    async with lock:
                        current_count += 1
                        c = current_count
                        if update_links:
                            df.iat[row_idx, col_idx] = drive_link
                        global_stats["success"] += 1
                        global_stats["skipped_duplicates"] += 1
                        report(
                            f"♻️ [{c}/{total_items}] L{real_row} [Col '{col_name}'] : Photo déjà migrée réutilisée (déduplication)",
                            c,
                            total_items,
                            current_action="Déduplication",
                            success=global_stats["success"],
                            failed=global_stats["failed"],
                        )
                    return

                ext = self._extract_file_extension(url)
                display_name = f"row_{real_row}_{col_idx}{ext}"

                if col_idx > 0:
                    prev_val = str(df.iat[row_idx, col_idx - 1]).strip()
                    if prev_val and prev_val not in ("nan", "None"):
                        if any(
                            prev_val.lower().endswith(e)
                            for e in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".mp4"]
                        ):
                            display_name = prev_val
                        else:
                            display_name = f"{prev_val}{ext}"

                async with lock:
                    current_count += 1
                    c = current_count
                    report(
                        f"⬇️ [{c}/{total_items}] L{real_row} : Téléchargement ({display_name})...",
                        c,
                        total_items,
                        current_action="Téléchargement Kobo",
                        success=global_stats["success"],
                        failed=global_stats["failed"],
                    )

                local_path = os.path.join(self.temp_dir, f"temp_{real_row}_{col_idx}_{c}{ext}")

                async with sem:
                    download_success, download_reason = await self._kobo_download_retry(url, local_path)

                if download_success:
                    try:
                        drive_link = await self.google.upload_file(local_path, target_folder, display_name)
                        migrated_urls_cache[url] = drive_link

                        async with lock:
                            if update_links:
                                df.iat[row_idx, col_idx] = drive_link
                            global_stats["success"] += 1
                            action = "migré" if update_links else "uploadé"
                            report(
                                f"✅ [{c}/{total_items}] L{real_row} [Col '{col_name}'] {action} vers Drive",
                                c,
                                total_items,
                                current_action="Upload Drive",
                                success=global_stats["success"],
                                failed=global_stats["failed"],
                            )
                    except Exception as e:
                        async with lock:
                            report(
                                f"❌ [{c}/{total_items}] Erreur Drive (L{real_row}) : {e}",
                                c,
                                total_items,
                                current_action="Erreur Drive",
                                success=global_stats["success"],
                                failed=global_stats["failed"] + 1,
                            )
                            logger.exception(f"Erreur Drive migration Excel ligne {real_row}")
                            global_stats["failed"] += 1
                            global_stats["failed_items"].append({
                                "sheet": s_name,
                                "row": real_row,
                                "col": col_name,
                                "url": url,
                                "reason": f"Erreur Google Drive: {str(e)}",
                            })
                    finally:
                        if os.path.exists(local_path):
                            try:
                                os.remove(local_path)
                            except Exception:
                                pass
                else:
                    async with lock:
                        report(
                            f"⚠️ [{c}/{total_items}] Échec Kobo (L{real_row}) : {download_reason}",
                            c,
                            total_items,
                            current_action="Échec Kobo",
                            success=global_stats["success"],
                            failed=global_stats["failed"] + 1,
                        )
                        global_stats["failed"] += 1
                        global_stats["failed_items"].append({
                            "sheet": s_name,
                            "row": real_row,
                            "col": col_name,
                            "url": url,
                            "reason": download_reason,
                        })

            tasks = [excel_worker(item) for item in valid_items]
            await asyncio.gather(*tasks)

            all_dfs[s_name] = df

        if update_links:
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                for s, df in all_dfs.items():
                    df.to_excel(writer, sheet_name=s, index=False)
            output.seek(0)
            report(
                "📦 Fichier Excel mis à jour prêt au téléchargement.",
                current_count,
                total_items,
                current_action="Terminé",
                success=global_stats["success"],
                failed=global_stats["failed"],
            )
            return output.read(), global_stats
        else:
            report(
                "✔️ Photos uploadées sur Drive. Le fichier Excel source n'a pas été modifié.",
                current_count,
                total_items,
                current_action="Terminé",
                success=global_stats["success"],
                failed=global_stats["failed"],
            )
            return None, global_stats

    # ═══════════════════════════════════════════════════════════════
    #  Helpers
    # ═══════════════════════════════════════════════════════════════

    async def _kobo_download_retry(self, url: str, path: str) -> Tuple[bool, str]:
        last_reason = "Aucun compte Kobo n'a pu télécharger le média"
        for acc in self.kobo_accounts:
            try:
                success, reason = await KoboService.download_media_file(acc, url, path)
                if success:
                    return True, reason
                last_reason = reason
            except Exception as e:
                last_reason = str(e)
                continue
        return False, last_reason

    @staticmethod
    def _resolve_target_folder(sheet_name: str, mapping: Optional[dict], default_folder: str) -> Optional[str]:
        normalized = sheet_name.strip().lower()
        if mapping:
            for k, fid in mapping.items():
                if k.strip().lower() == normalized:
                    return fid
        return default_folder if default_folder else None

    @staticmethod
    def _extract_file_extension(url: str) -> str:
        """Extrait l'extension du fichier depuis l'URL Kobo ou renvoie .jpg par défaut."""
        if not url:
            return ".jpg"
        try:
            parsed = urllib.parse.urlparse(url)
            path = parsed.path
            ext = os.path.splitext(path)[1].lower()
            valid_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".mp4", ".mov", ".avi"}
            if ext in valid_exts:
                return ext
            query_params = urllib.parse.parse_qs(parsed.query)
            for key, vals in query_params.items():
                for val in vals:
                    e = os.path.splitext(val)[1].lower()
                    if e in valid_exts:
                        return e
        except Exception:
            pass
        return ".jpg"

    @staticmethod
    def _get_column_letter(n):
        result = ""
        while n > 0:
            n, remainder = divmod(n - 1, 26)
            result = chr(65 + remainder) + result
        return result
