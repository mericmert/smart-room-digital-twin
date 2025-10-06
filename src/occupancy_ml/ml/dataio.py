from __future__ import annotations
from pathlib import Path
from typing import Tuple, Iterable, Optional, Dict, Any
import logging
import pandas as pd
import csv
from .anomaly_detection import AnomalyDetector, remove_anomalies, flag_anomalies, correct_anomalies
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


def read_occ_with_anomaly_detection(
    path: Path,
    target_col: str,
    timestamp_col: str,
    *,
    expected_columns: Iterable[str],
    numeric_features: Iterable[str],
    sort: bool = True,
    anomaly_detection: bool = True,
    anomaly_method: str = "combined",
    anomaly_handling: str = "remove",  # "remove", "flag", "correct", "none"
    anomaly_correction_method: str = "median",  # "median", "mean", "interpolate"
    contamination: float = 0.1,
    z_threshold: float = 3.0,
    iqr_multiplier: float = 1.5,
    domain_thresholds: Optional[Dict[str, Dict[str, float]]] = None,
) -> Tuple[pd.DataFrame, Optional[Dict[str, Any]]]:
    """
    Reads an Occupancy dataset CSV with optional anomaly detection and handling.
    
    Args:
        path: Path to the CSV file
        target_col: Name of the target column
        timestamp_col: Name of the timestamp column
        expected_columns: Expected column names
        numeric_features: List of numeric feature columns
        sort: Whether to sort by timestamp
        anomaly_detection: Whether to perform anomaly detection
        anomaly_method: Method for anomaly detection ("statistical", "isolation_forest", "domain", "combined")
        anomaly_handling: How to handle anomalies ("remove", "flag", "correct", "none")
        anomaly_correction_method: Method for correcting anomalies ("median", "mean", "interpolate")
        contamination: Expected proportion of anomalies (for Isolation Forest)
        z_threshold: Z-score threshold for statistical detection
        iqr_multiplier: IQR multiplier for outlier detection
        domain_thresholds: Domain-specific thresholds for each sensor
        
    Returns:
        Tuple of (processed_dataframe, anomaly_summary)
    """
    # First read the data normally
    df = read_occ(
        path=path,
        target_col=target_col,
        timestamp_col=timestamp_col,
        expected_columns=expected_columns,
        numeric_features=numeric_features,
        sort=sort
    )
    
    anomaly_summary = None
    
    if not anomaly_detection:
        return df, anomaly_summary
    
    logger.info("Performing anomaly detection...")
    
    # Initialize anomaly detector
    detector = AnomalyDetector(
        method=anomaly_method,
        contamination=contamination,
        z_threshold=z_threshold,
        iqr_multiplier=iqr_multiplier,
        domain_thresholds=domain_thresholds
    )
    
    # Fit detector on the data
    detector.fit(df, list(numeric_features))
    
    # Detect anomalies
    anomaly_mask = detector.detect_anomalies(df, list(numeric_features))
    
    # Get anomaly summary
    anomaly_summary = detector.get_anomaly_summary(df, anomaly_mask)
    logger.info(f"Anomaly detection complete: {anomaly_summary['anomaly_count']} anomalies found "
                f"({anomaly_summary['anomaly_rate']:.2%} of data)")
    
    # Handle anomalies based on the specified method
    if anomaly_handling == "remove":
        df = remove_anomalies(df, anomaly_mask)
        logger.info(f"Removed anomalies. New dataset size: {len(df)} rows")
    elif anomaly_handling == "flag":
        df = flag_anomalies(df, anomaly_mask)
        logger.info("Flagged anomalies with 'is_anomaly' column")
    elif anomaly_handling == "correct":
        df = correct_anomalies(df, anomaly_mask, method=anomaly_correction_method)
        logger.info(f"Corrected anomalies using {anomaly_correction_method} method")
    elif anomaly_handling == "none":
        logger.info("Anomalies detected but not handled")
    else:
        raise ValueError(f"Unknown anomaly handling method: {anomaly_handling}")
    
    return df, anomaly_summary


if __name__ == '__main__':
    df = read_occ(path=Path("data/datatraining.txt"))
    print(df)