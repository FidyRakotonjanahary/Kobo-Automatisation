import csv
import io
import logging
import os
import re
from typing import Any, Dict, List, Optional

import pandas as pd

from app.core.task_monitor import task_monitor
from app.utils.normalizer import TextNormalizer
from app.utils.text_encoding import repair_dataframe_columns

logger = logging.getLogger("export_engine")


class ExportEngine:
    def __init__(self, output_base_dir: Optional[str] = None):
        if output_base_dir:
            self.output_base_dir = output_base_dir
        else:
            # On remonte de 3 niveaux depuis backend/app/services/export_engine.py 
            # pour arriver à la racine du projet
            root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
            self.output_base_dir = os.path.join(root_dir, "Exports_Kobo")
            
        if not os.path.isabs(self.output_base_dir):
            self.output_base_dir = os.path.abspath(self.output_base_dir)
            
        os.makedirs(self.output_base_dir, exist_ok=True)

    @staticmethod
    def _derive_file_prefix(form_name: str) -> str:
        normalized = TextNormalizer.normalize(form_name)
        normalized = re.sub(r"[^A-Z0-9_]+", "_", normalized)
        normalized = re.sub(r"_+", "_", normalized).strip("_")

        if "AGR" in normalized.split("_"):
            return normalized

        known_prefixes = [
            ("FOCUS_GROUPE", "FOCUS_GROUPE"),
            ("AUTORITES_LOCALES", "AUTORITES_LOCALES"),
            ("AUTORITE_LOCALE", "AUTORITES_LOCALES"),
            ("ENVIRONNEMENTAL", "ENVIRONNEMENTAL"),
            ("LALANA", "LALANA"),
            ("UPE", "UPE"),
        ]
        for marker, prefix in known_prefixes:
            if marker in normalized:
                return prefix

        stop_words = {
            "QUESTIONNAIRE",
            "ENQUETE",
            "FORMULAIRE",
            "ANKA",
            "PHAOS",
            "VF",
            "ET",
            "DE",
            "DU",
            "DES",
            "LE",
            "LA",
            "LES",
        }
        tokens = [
            token
            for token in normalized.split("_")
            if token and token not in stop_words
        ]
        return "_".join(tokens[:2]) if tokens else "EXPORT"

    @staticmethod
    def _safe_file_part(value: str) -> str:
        safe = re.sub(r'[<>:"/\\|?*]+', "_", str(value or "").strip())
        safe = re.sub(r"\s+", "_", safe)
        safe = re.sub(r"_+", "_", safe).strip("._ ")
        return safe or "export"

    @staticmethod
    def _resolve_csv_sheet(
        sheet_names: List[str], selected_sheets: Optional[List[str]]
    ) -> str:
        if selected_sheets:
            for sheet_name in selected_sheets:
                if sheet_name in sheet_names:
                    return sheet_name
            raise ValueError(f"Onglet CSV introuvable: {selected_sheets[0]}")
        return sheet_names[0]

    @staticmethod
    def _filter_related_sheet_for_site(
        sheet_df: pd.DataFrame, site_main_df: pd.DataFrame, valid_indices: List[Any]
    ) -> pd.DataFrame:
        if site_main_df.empty and not valid_indices:
            return sheet_df.iloc[0:0].copy()

        # Stratégie 1 : Par UUID de soumission (Lien universel et le plus stable de Kobo)
        relation_pairs = [
            ("_submission__uuid", "_uuid"),
            ("_submission_uuid", "_uuid"),
            ("_parent_uuid", "_uuid"),
            ("_submission__id", "_id"),
            ("PARENT_KEY", "KEY"),
        ]
        for child_col, parent_col in relation_pairs:
            if child_col in sheet_df.columns and parent_col in site_main_df.columns:
                parent_values = site_main_df[parent_col].dropna().astype(str).unique()
                filtered = sheet_df[sheet_df[child_col].astype(str).isin(parent_values)].copy()
                if not filtered.empty:
                    return filtered

        # Stratégie 2 : Par parent_index ( fallback si les UUIDs manquent)
        if "_parent_index" in sheet_df.columns:
            # On nettoie les indices (parfois '1.0' au lieu de '1')
            idx_str = [str(v).split(".")[0] for v in (valid_indices or [])]
            filtered = sheet_df[sheet_df["_parent_index"].astype(str).apply(lambda x: x.split(".")[0]).isin(idx_str)].copy()
            if not filtered.empty:
                return filtered

        # Stratégie 3 : Par ID technique
        if "_submission__id" in sheet_df.columns and "_id" in site_main_df.columns:
            parent_ids = site_main_df["_id"].dropna().astype(str).unique()
            filtered = sheet_df[sheet_df["_submission__id"].astype(str).isin(parent_ids)].copy()
            if not filtered.empty:
                return filtered

        # Si aucun lien n'est trouvé, mais que site_main_df n'est PAS l'onglet principal
        # Cela peut arriver si l'onglet enfant est orphelin ou si les noms de colonnes sont exotiques.
        logger.warning("Lien introuvable pour l'onglet enfant. Exportation vide pour ce site.")
        return sheet_df.iloc[0:0].copy()

    @staticmethod
    def _format_kobo_index_value(value: Any) -> Any:
        if pd.isna(value):
            return value
        if isinstance(value, float) and value.is_integer():
            text = str(int(value))
        else:
            text = str(value).strip()
        if re.fullmatch(r"\d+(\.0+)?", text):
            text = text.split(".", 1)[0]
            return f"S0_{text}"
        return text

    @classmethod
    def _format_kobo_index_columns(cls, df: pd.DataFrame) -> pd.DataFrame:
        formatted = df.copy()
        for column in ("_index", "_parent_index"):
            if column in formatted.columns:
                formatted[column] = formatted[column].apply(
                    cls._format_kobo_index_value
                )
        
        # Nettoyer toutes les colonnes numériques float qui ne contiennent que des valeurs entières (pour enlever le .0 indésirable)
        for col in formatted.columns:
            if pd.api.types.is_numeric_dtype(formatted[col]):
                non_nulls = formatted[col].dropna()
                if not non_nulls.empty:
                    try:
                        # Si tous les nombres existants dans la colonne sont entiers (modulo 1 == 0),
                        # on applique le type Pandas Int64 qui gère les NaN tout en enlevant le .0
                        if (non_nulls % 1 == 0).all():
                            formatted[col] = formatted[col].astype("Int64")
                    except Exception:
                        pass
        return formatted

    def run_pipeline_from_bytes(
        self,
        excel_content: bytes,
        form_name: str,
        pivot_column: str,
        selected_columns: Optional[List[str]] = None,
        filter_sites: Optional[List[str]] = None,
        selected_sheets: Optional[List[str]] = None,
        export_format: str = "xlsx",
        csv_params: Optional[Dict[str, str]] = None,
        task_id: Optional[str] = None,
    ):
        """Pipeline depuis un fichier Excel brut (compte unique)."""
        dfs = pd.read_excel(io.BytesIO(excel_content), sheet_name=None)
        return self._run(
            dfs,
            form_name,
            pivot_column,
            selected_columns,
            filter_sites,
            selected_sheets,
            export_format,
            csv_params,
            task_id,
        )

    def run_pipeline_from_dfs(
        self,
        merged_dfs: Dict[str, pd.DataFrame],
        form_name: str,
        pivot_column: str,
        selected_columns: Optional[List[str]] = None,
        filter_sites: Optional[List[str]] = None,
        selected_sheets: Optional[List[str]] = None,
        export_format: str = "xlsx",
        csv_params: Optional[Dict[str, str]] = None,
        task_id: Optional[str] = None,
    ):
        """Pipeline depuis des DataFrames déjà fusionnés (multi-comptes)."""
        return self._run(
            merged_dfs,
            form_name,
            pivot_column,
            selected_columns,
            filter_sites,
            selected_sheets,
            export_format,
            csv_params,
            task_id,
        )

    def _run(
        self,
        dfs: Dict[str, pd.DataFrame],
        form_name: str,
        pivot_column: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        filter_sites: Optional[List[str]] = None,
        selected_sheets: Optional[List[str]] = None,
        export_format: str = "xlsx",
        csv_params: Optional[Dict[str, str]] = None,
        task_id: Optional[str] = None,
    ):

        logger.info(
            "Démarrage du pipeline (%s) pour: %s (pivot: %s)",
            export_format,
            form_name,
            pivot_column,
        )

        dfs = {name: repair_dataframe_columns(df) for name, df in dfs.items()}
        all_sheets_avail = list(dfs.keys())
        if not all_sheets_avail:
            raise ValueError("Le fichier source est vide.")

        # Identification ROBUSTE de l'onglet principal (Root)
        def find_main_sheet():
            for s in all_sheets_avail:
                cols = [str(c).lower() for c in dfs[s].columns]
                if 'start' in cols or '_uuid' in cols or 'deviceid' in cols:
                    return s
            return all_sheets_avail[0]

        main_sheet_name = find_main_sheet()
        main_df = dfs[main_sheet_name].copy()
        generated_files = []
        unique_sites = []
        matched_pivot_col = None
        source_df = None

        if pivot_column:
            target_norm = pivot_column.replace("_", " ").strip().lower()
            search_order = [all_sheets_avail[0]] + [s for s in all_sheets_avail if s != all_sheets_avail[0]]
            
            for s_name in search_order:
                s_df = dfs[s_name]
                for col in s_df.columns:
                    if str(col).replace("_", " ").strip().lower() == target_norm:
                        matched_pivot_col = col
                        source_df = s_df
                        break
                if source_df is not None:
                    break

            if source_df is not None:
                for s_df in dfs.values():
                    if matched_pivot_col in s_df.columns:
                        s_df[matched_pivot_col] = (
                            s_df[matched_pivot_col]
                            .fillna("NON_DEFINI")
                            .apply(str)
                            .apply(TextNormalizer.normalize)
                        )
                unique_sites = sorted(source_df[matched_pivot_col].unique())
        
        if filter_sites:
            unique_sites = [s for s in unique_sites if s in filter_sites]

        if not unique_sites:
            unique_sites = ["Dataset_Complet"]
            pivot_column = "Export_Type"
            main_df[pivot_column] = "Dataset_Complet"
            source_df = main_df

        form_folder = os.path.join(
            self.output_base_dir, TextNormalizer.normalize(form_name)
        )
        os.makedirs(form_folder, exist_ok=True)
        file_prefix = self._derive_file_prefix(form_name)

        generated_files = []

        # Paramètres CSV par défaut
        csv_config = {
            "sep": ";",
            "encoding": "utf-8-sig",
            "quotechar": '"',
            "quoting": csv.QUOTE_MINIMAL,
            "lineterminator": "\r\n",
        }
        if csv_params:
            csv_config.update(csv_params)

        # --- REGROUPEMENT INTELLIGENT PAR RACINE ---
        # Si on a ANKAVANDRA, ANKAVANDRA_NORD, ANKAVANDRA_SUD, on les met dans le même groupe "ANKAVANDRA"
        site_groups = {}
        for s in unique_sites:
            # On prend le premier mot avant l'underscore comme racine
            root = s.split("_")[0] if "_" in s else s
            if root not in site_groups:
                site_groups[root] = []
            site_groups[root].append(s)

        for group_name, group_sites in site_groups.items():
            # Le nom du fichier sera basé sur la racine (le groupe)
            site_display = group_name 
            
            # --- POINT D'ARRÊT ---
            if task_id and task_monitor.is_cancelled(task_id):
                logger.warning(f"Arrêt de l'exportation demandé pour {task_id}")
                break

            # Filtrage de TOUS les sites appartenant à ce groupe
            def match_in_group(val):
                return TextNormalizer.normalize(str(val)) in group_sites

            if matched_pivot_col in main_df.columns:
                # Pivot classique dans l'onglet principal
                site_main_df = main_df[main_df[matched_pivot_col].apply(match_in_group)]
                valid_indices = site_main_df["_index"].apply(lambda x: str(x).split(".")[0]).tolist() if "_index" in site_main_df.columns else []
            else:
                # Pivot dans un onglet enfant (Repeat Group)
                anchor_df = source_df[source_df[matched_pivot_col].apply(match_in_group)]
                if "_parent_index" in anchor_df.columns:
                    valid_indices = anchor_df["_parent_index"].apply(lambda x: str(x).split(".")[0]).unique().tolist()
                else:
                    valid_indices = []
                
                if "_index" in main_df.columns:
                    site_main_df = main_df[main_df["_index"].apply(lambda x: str(x).split(".")[0]).isin(valid_indices)]
                else:
                    site_main_df = pd.DataFrame(columns=main_df.columns)
                
                site_main_df = site_main_df.copy()
                site_main_df[pivot_column] = site_display

            site_export_main = site_main_df.copy()

            try:
                if export_format == "csv":
                    # --- RECHERCHE PAR FORCE BRUTE (NOM OU POSITION) ---
                    selected_name = selected_sheets[0] if selected_sheets else main_sheet_name
                    selected_clean = TextNormalizer.normalize(selected_name)
                    
                    # On cherche l'onglet par nom
                    csv_sheet_name = None
                    for s_name in all_sheets_avail:
                        if TextNormalizer.normalize(s_name) == selected_clean:
                            csv_sheet_name = s_name
                            break
                    
                    # Fallback ultime ou si c'est l'onglet principal
                    if not csv_sheet_name or csv_sheet_name == main_sheet_name:
                        final_df = site_export_main.copy()
                        sheet_suffix = None
                    else:
                        child_raw = dfs[csv_sheet_name]
                        final_df = self._filter_related_sheet_for_site(
                            child_raw, site_main_df, valid_indices
                        )
                        sheet_suffix = self._safe_file_part(csv_sheet_name)

                    # On s'assure que la colonne Pivot est présente
                    if matched_pivot_col not in final_df.columns:
                        final_df = final_df.copy()
                        final_df[pivot_column] = site_display

                    csv_export_df = self._format_kobo_index_columns(final_df)

                    suffix = f"_{sheet_suffix}" if sheet_suffix else ""
                    file_path = os.path.join(
                        form_folder, f"{file_prefix}_{site_display}{suffix}.csv"
                    )
                    csv_export_df.to_csv(
                        file_path,
                        index=False,
                        sep=csv_config["sep"],
                        encoding=csv_config["encoding"],
                        quotechar=csv_config["quotechar"],
                        quoting=csv_config["quoting"],
                        lineterminator=csv_config["lineterminator"],
                    )
                    exported_rows = len(csv_export_df)
                else:
                    file_path = os.path.join(form_folder, f"{file_prefix}_{site_display}.xlsx")
                    # Export Excel
                    with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
                        sheets_written = 0
                        normalized_selected = [s.strip().lower() for s in (selected_sheets or [])]
                        
                        main_sheet_lower = main_sheet_name.strip().lower()
                        
                        is_main_selected = not selected_sheets or \
                                          main_sheet_lower in normalized_selected or \
                                          any(main_sheet_lower.startswith(s[:25]) for s in normalized_selected) or \
                                          any(s.startswith(main_sheet_lower[:25]) for s in normalized_selected)
                        
                        if is_main_selected:
                            self._format_kobo_index_columns(site_export_main).to_excel(
                                writer, sheet_name=main_sheet_name[:31], index=False
                            )
                            sheets_written += 1

                        for s_name in all_sheets_avail[1:]:
                            if selected_sheets and s_name.strip().lower() not in normalized_selected:
                                continue
                            child_df = dfs[s_name]
                            site_child_df = self._filter_related_sheet_for_site(
                                child_df, site_main_df, valid_indices
                            )
                            
                            if matched_pivot_col not in site_child_df.columns:
                                site_child_df = site_child_df.copy()
                                site_child_df[pivot_column] = site_display

                            if site_child_df.empty:
                                logger.warning(
                                    "Onglet '%s' vide pour le groupe '%s'",
                                    s_name, group_name,
                                )
                            self._format_kobo_index_columns(
                                site_child_df
                            ).to_excel(
                                writer, sheet_name=s_name[:31], index=False
                            )
                            sheets_written += 1

                        if sheets_written == 0:
                            pd.DataFrame().to_excel(
                                writer, sheet_name="Vide", index=False
                            )
                    exported_rows = len(site_main_df)

                generated_files.append(
                    {"site": site_display, "path": file_path, "rows": exported_rows}
                )
            except Exception as e:
                logger.error(f"Erreur pour le groupe {group_name}: {e}")

        return generated_files
