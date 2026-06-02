import pandas as pd
import os
import io
import logging
import csv
import re
from typing import List, Dict, Any, Optional
from app.utils.normalizer import TextNormalizer
from app.utils.text_encoding import repair_dataframe_columns

logger = logging.getLogger("export_engine")

class ExportEngine:
    def __init__(self, output_base_dir: str = "exports"):
        self.output_base_dir = output_base_dir
        if not os.path.isabs(self.output_base_dir):
            self.output_base_dir = os.path.abspath(self.output_base_dir)
        os.makedirs(self.output_base_dir, exist_ok=True)

    @staticmethod
    def _derive_file_prefix(form_name: str) -> str:
        normalized = TextNormalizer.normalize(form_name)
        normalized = re.sub(r"[^A-Z0-9_]+", "_", normalized)
        normalized = re.sub(r"_+", "_", normalized).strip("_")

        if "AGR" in normalized.split("_"):
            return "AGR"

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
            "QUESTIONNAIRE", "ENQUETE", "FORMULAIRE", "ANKA", "PHAOS",
            "VF", "ET", "DE", "DU", "DES", "LE", "LA", "LES",
        }
        tokens = [token for token in normalized.split("_") if token and token not in stop_words]
        return "_".join(tokens[:2]) if tokens else "EXPORT"

    @staticmethod
    def _safe_file_part(value: str) -> str:
        safe = re.sub(r'[<>:"/\\|?*]+', "_", str(value or "").strip())
        safe = re.sub(r"\s+", "_", safe)
        safe = re.sub(r"_+", "_", safe).strip("._ ")
        return safe or "export"

    @staticmethod
    def _resolve_csv_sheet(sheet_names: List[str], selected_sheets: Optional[List[str]]) -> str:
        if selected_sheets:
            for sheet_name in selected_sheets:
                if sheet_name in sheet_names:
                    return sheet_name
            raise ValueError(f"Onglet CSV introuvable: {selected_sheets[0]}")
        return sheet_names[0]

    @staticmethod
    def _filter_related_sheet_for_site(
        sheet_df: pd.DataFrame,
        site_main_df: pd.DataFrame,
        valid_indices: List[Any]
    ) -> pd.DataFrame:
        if "_parent_index" in sheet_df.columns and valid_indices:
            return sheet_df[sheet_df["_parent_index"].isin(valid_indices)].copy()

        relation_pairs = [
            ("_submission__uuid", "_uuid"),
            ("_submission_uuid", "_uuid"),
            ("_parent_uuid", "_uuid"),
            ("_submission__id", "_id"),
            ("_submission_id", "_id"),
        ]
        for child_col, parent_col in relation_pairs:
            if child_col in sheet_df.columns and parent_col in site_main_df.columns:
                parent_values = site_main_df[parent_col].dropna().astype(str)
                return sheet_df[sheet_df[child_col].astype(str).isin(parent_values)].copy()

        logger.warning("Impossible de relier l'onglet secondaire au site; export vide.")
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
                formatted[column] = formatted[column].apply(cls._format_kobo_index_value)
        return formatted

    def run_pipeline_from_bytes(self,
                                excel_content: bytes,
                                form_name: str,
                                pivot_column: str,
                                selected_columns: Optional[List[str]] = None,
                                filter_sites: Optional[List[str]] = None,
                                selected_sheets: Optional[List[str]] = None,
                                export_format: str = "xlsx",
                                csv_params: Optional[Dict[str, str]] = None):
        """Pipeline depuis un fichier Excel brut (compte unique)."""
        dfs = pd.read_excel(io.BytesIO(excel_content), sheet_name=None)
        return self._run(dfs, form_name, pivot_column, selected_columns, filter_sites, selected_sheets, export_format, csv_params)

    def run_pipeline_from_dfs(self,
                               merged_dfs: Dict[str, pd.DataFrame],
                               form_name: str,
                               pivot_column: str,
                               selected_columns: Optional[List[str]] = None,
                               filter_sites: Optional[List[str]] = None,
                               selected_sheets: Optional[List[str]] = None,
                               export_format: str = "xlsx",
                               csv_params: Optional[Dict[str, str]] = None):
        """Pipeline depuis des DataFrames déjà fusionnés (multi-comptes)."""
        return self._run(merged_dfs, form_name, pivot_column, selected_columns, filter_sites, selected_sheets, export_format, csv_params)

    def _run(self,
             dfs: Dict[str, pd.DataFrame],
             form_name: str,
             pivot_column: Optional[str] = None,
             selected_columns: Optional[List[str]] = None,
             filter_sites: Optional[List[str]] = None,
             selected_sheets: Optional[List[str]] = None,
             export_format: str = "xlsx",
             csv_params: Optional[Dict[str, str]] = None):

        logger.info(f"Démarrage du pipeline ({export_format}) pour: {form_name} (pivot: {pivot_column})")

        dfs = {name: repair_dataframe_columns(df) for name, df in dfs.items()}
        sheet_names = list(dfs.keys())
        if not sheet_names:
            raise ValueError("Le fichier source est vide.")

        csv_sheet_name = self._resolve_csv_sheet(sheet_names, selected_sheets) if export_format == "csv" else sheet_names[0]
        main_df = dfs[sheet_names[0]].copy()

        # Si pas de pivot, on exporte tout dans un seul fichier
        if not pivot_column:
            unique_sites = ["Dataset_Complet"]
            pivot_column = "Export_Type"
            main_df[pivot_column] = "Dataset_Complet"
        else:
            if pivot_column not in main_df.columns:
                raise ValueError(f"Colonne '{pivot_column}' introuvable.")
            main_df[pivot_column] = main_df[pivot_column].fillna("NON_DEFINI").apply(TextNormalizer.normalize)
            unique_sites = sorted(main_df[pivot_column].unique())

        form_folder = os.path.join(self.output_base_dir, TextNormalizer.normalize(form_name))
        os.makedirs(form_folder, exist_ok=True)
        file_prefix = self._derive_file_prefix(form_name)

        total_rows = len(main_df)
        generated_files = []
        
        # Paramètres CSV par défaut
        csv_config = {
            "sep": ";",
            "encoding": "utf-8-sig",
            "quotechar": '"',
            "quoting": csv.QUOTE_MINIMAL,
            "lineterminator": "\r\n"
        }
        if csv_params:
            csv_config.update(csv_params)

        for site in unique_sites:
            if filter_sites and site not in filter_sites:
                continue
            site_main_df = main_df[main_df[pivot_column] == site]
            valid_indices = site_main_df["_index"].tolist() if "_index" in site_main_df.columns else []

            # Filtrage colonnes
            if selected_columns is not None:
                actual_cols = [c for c in selected_columns if c in site_main_df.columns]
                mandatory = ["_id", "_index", "_uuid", "_submission_time", "_parent_index", pivot_column]
                for m in mandatory:
                    if m in site_main_df.columns and m not in actual_cols:
                        actual_cols.append(m)
                site_export_main = site_main_df[actual_cols]
            else:
                site_export_main = site_main_df
                
            try:
                if export_format == "csv":
                    if csv_sheet_name == sheet_names[0]:
                        csv_export_df = self._format_kobo_index_columns(site_export_main)
                        sheet_suffix = None
                    else:
                        csv_export_df = self._format_kobo_index_columns(self._filter_related_sheet_for_site(
                            dfs[csv_sheet_name],
                            site_main_df,
                            valid_indices
                        ))
                        sheet_suffix = self._safe_file_part(csv_sheet_name)

                    suffix = f"_{sheet_suffix}" if sheet_suffix else ""
                    file_path = os.path.join(form_folder, f"{file_prefix}_{site}{suffix}.csv")
                    csv_export_df.to_csv(
                        file_path, 
                        index=False, 
                        sep=csv_config["sep"], 
                        encoding=csv_config["encoding"], 
                        quotechar=csv_config["quotechar"],
                        quoting=csv_config["quoting"],
                        lineterminator=csv_config["lineterminator"]
                    )
                    exported_rows = len(csv_export_df)
                else:
                    file_path = os.path.join(form_folder, f"{file_prefix}_{site}.xlsx")
                    # Export Excel
                    with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                        main_sheet_name = sheet_names[0]
                        if (not selected_sheets or main_sheet_name in selected_sheets):
                            self._format_kobo_index_columns(site_export_main).to_excel(writer, sheet_name=main_sheet_name[:31], index=False)

                        # Repeat Groups
                        for s_name in sheet_names[1:]:
                            if selected_sheets and s_name not in selected_sheets:
                                continue
                            child_df = dfs[s_name]
                            if "_parent_index" in child_df.columns:
                                site_child_df = child_df[child_df["_parent_index"].isin(valid_indices)]
                                if not site_child_df.empty:
                                    self._format_kobo_index_columns(site_child_df).to_excel(writer, sheet_name=s_name[:31], index=False)
                    exported_rows = len(site_main_df)

                generated_files.append({
                    "site": site,
                    "path": file_path,
                    "rows": exported_rows
                })
            except Exception as e:
                logger.error(f"Erreur pour le site {site}: {e}")

        return generated_files
