from __future__ import annotations

import pandas as pd

MOJIBAKE_MARKERS = ("Ã", "Â", "â")


def repair_mojibake_text(value: str) -> str:
    if not any(marker in value for marker in MOJIBAKE_MARKERS):
        return value

    for encoding in ("latin1", "cp1252"):
        try:
            repaired = value.encode(encoding).decode("utf-8")
        except UnicodeError:
            continue

        old_score = sum(value.count(marker) for marker in MOJIBAKE_MARKERS)
        new_score = sum(repaired.count(marker) for marker in MOJIBAKE_MARKERS)
        if new_score < old_score:
            return repaired

    return value


def repair_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [repair_mojibake_text(str(column)) for column in df.columns]
    return df
