from __future__ import annotations
from pathlib import Path
from typing import Tuple, Iterable
import logging
import pandas as pd
import csv
logger = logging.getLogger(__name__)

def _coerce_numeric(df: pd.DataFrame, cols: Iterable[str]) -> None:
    """In-place: make columns numeric with NaNs on bad values and memory-friendly dtypes."""
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce", downcast="float")
    
def _validate_cols(df: pd.DataFrame, expected: Iterable[str]) -> None:
    missing = [c for c in expected if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required column(s): {missing}. Found: {list(df.columns)}")

def read_occ(
    path: Path,
    target_col: str,
    timestamp_col: str,
    *,
    expected_columns: Iterable[str],
    numeric_features: Iterable[str],
    sort: bool = True,
) -> pd.DataFrame:
    """
    Reads an Occupancy dataset CSV with robust defaults.

    - Automatically detects delimiter.
    - Parses the timestamp column into datetime (invalid values become NaT).
    - Converts the classification target column to Int8 (nullable).
    - Cleans header whitespace.
    - Sorts by timestamp (stable sort).
    """
    
    logger.info("Reading occupancy data from %s", path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    df = pd.read_csv(
        path,
        engine="python",
        sep=None, # infer delimeter
        skipinitialspace=True,
        na_values=["", "NA", "NAN", "?", "null", "None"],
        quoting=csv.QUOTE_MINIMAL,
        on_bad_lines="warn"
    )
    
    logger.debug("Loaded CSV with %d rows and %d columns", df.shape[0], df.shape[1])

    df.columns = [c.strip() for c in df.columns]
    
    _validate_cols(df, expected_columns)
    
    if timestamp_col in df.columns:
        df[timestamp_col] = pd.to_datetime(df[timestamp_col], errors="coerce")
    else:
        raise ValueError(f"Expected timestamp column '{timestamp_col}' not found.")

    _coerce_numeric(df, numeric_features)

    if target_col not in df.columns:
        raise ValueError(f"Expected target column '{target_col}' not found.")
    df[target_col] = pd.to_numeric(df[target_col], errors="coerce").astype("Int8")

    if sort:
        df = df.sort_values(timestamp_col, kind="mergesort").reset_index(drop=True)
    
    logger.info("Finished reading %s (rows=%d, cols=%d)", path.name, df.shape[0], df.shape[1])
    return df.copy()

if __name__ == '__main__':
    df = read_occ(path=Path("data/datatraining.txt"))
    print(df)