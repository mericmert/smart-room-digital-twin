from __future__ import annotations
from typing import Iterable, List, Tuple
import logging
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

def infer_numeric_features(
    df: pd.DataFrame,
    exclude: Iterable[str] = (),
) -> List[str]:
    """Infer numeric feature columns, excluding given names."""
    numeric_mask = df.dtypes.apply(pd.api.types.is_numeric_dtype)
    candidates = [c for c, is_num in numeric_mask.items() if is_num]
    return [c for c in candidates if c not in exclude]

def add_time_features(
    df: pd.DataFrame,
    *,
    timestamp_col: str = "date",
    make_cyclic: bool = True,
    weekend_as_int: bool = True,
) -> pd.DataFrame:
    """
    Add hour/dayofweek/is_weekend; optionally add cyclic encodings.
    Returns a copy.
    """
    if timestamp_col not in df:
        raise ValueError(f"timestamp_col '{timestamp_col}' not found in DataFrame.")

    out = df.copy()
    dt = out[timestamp_col].dt
    
    if "hour" not in out:
        out["hour"] = dt.hour
    if "dayofweek" not in out:
        out["dayofweek"] = dt.dayofweek
    if "is_weekend" not in out:
        out["is_weekend"] = (dt.dayofweek >= 5)
    
    if weekend_as_int:
        out["is_weekend"] = out["is_weekend"].astype("uint8")
    
    # Cycling encodings (often outperform raw hour/dow for linear models)
    if make_cyclic:
        if "hour_sin" not in out:
            out["hour_sin"] = np.sin(2 * np.pi * out["hour"] / 24.0)
        if "hour_cos" not in out:
            out["hour_cos"] = np.cos(2 * np.pi * out["hour"] / 24.0)
        if "dow_sin" not in out:
            out["dow_sin"] = np.sin(2 * np.pi * out["dayofweek"] / 7.0)
        if "dow_cos" not in out:
            out["dow_cos"] = np.cos(2 * np.pi * out["dayofweek"] / 7.0)
    return out

def build_feature_matrix(
    df: pd.DataFrame,
    timestamp_col: str,
    target_col: str | None = None,
    extra_num_features: Iterable[str] = ()
) -> Tuple[pd.DataFrame, List[str]]:
    
    if not df[timestamp_col].is_monotonic_increasing:
        df = df.sort_values(timestamp_col, kind="mergesort").reset_index(drop=True)
    
    enriched = add_time_features(df, timestamp_col=timestamp_col)
    exclude = [c for c in [timestamp_col, target_col] if c]
    exclude_set = set(exclude)
    numeric = infer_numeric_features(enriched, exclude=exclude)

    extra = []
    for name in extra_num_features:
        if name in exclude_set:
            continue
        if name not in enriched.columns:
            raise ValueError(f"Requested extra feature '{name}' not found in DataFrame.")
        if not pd.api.types.is_numeric_dtype(enriched[name]):
            raise TypeError(f"Extra feature '{name}' must be numeric. Got {enriched[name].dtype}.")
        extra.append(name)

    feature_names = list(dict.fromkeys([*numeric, *extra]))
    X = enriched[feature_names].copy()
    return X, feature_names


def align_and_impute_like_train(
    X_train: pd.DataFrame,
    *X_tests: pd.DataFrame
) -> Tuple[pd.DataFrame, ...]:
    """
    Reindex tests to train columns and impute NaNs with train medians.
    Returns (X_train_filled, *X_tests_filled)
    """
    train_cols = X_train.columns
    train_medians = X_train.median(numeric_only=True)
    def _fix(X: pd.DataFrame) -> pd.DataFrame:
        Z = X.reindex(columns=train_cols)
        Z = Z.copy()
        for c in train_cols:
            if pd.api.types.is_numeric_dtype(Z[c]):
                Z[c] = Z[c].fillna(train_medians.get(c, 0))
            else:
                Z[c] = Z[c].fillna(0)
        return Z
    fixed = [_fix(df) for df in (X_train, *X_tests)]
    return tuple(fixed)
