
from __future__ import annotations
from pathlib import Path
import json
import logging
import joblib
from typing import Dict, Any, Optional, List, Tuple
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from .modeling import build_pipeline, param_grid
from .metrics import compute_metrics, plot_probability_curves, find_optimal_threshold
from .features import build_feature_matrix

logger = logging.getLogger(__name__)


def _build_temporal_splits(
    y: np.ndarray,
    *,
    n_splits: int,
    gap: int,
) -> Tuple[List[Tuple[np.ndarray, np.ndarray]], List[int], int]:
    """Construct time-ordered CV folds while ensuring every test and train block has positives."""
    from sklearn.model_selection import TimeSeriesSplit

    for current in range(n_splits, 1, -1):
        splitter = TimeSeriesSplit(n_splits=current, gap=gap, test_size=None)
        raw_splits = list(splitter.split(np.arange(len(y))))

        # Count positives in TEST for each split
        pos_test_counts = [int(y[test_idx].sum()) for _, test_idx in raw_splits]
        # Count positives in TRAIN for each split
        pos_train_counts = [int(y[train_idx].sum()) for train_idx, _ in raw_splits]

        # Require at least one positive in both train and test for EVERY split
        ok_test = all(c > 0 for c in pos_test_counts)
        ok_train = all(c > 0 for c in pos_train_counts)

        if ok_test and ok_train:
            if current != n_splits:
                logger.warning(
                    "Reducing n_splits from %d to %d to keep positives in every train/test fold.",
                    n_splits, current,
                )
            return raw_splits, pos_test_counts, current

    raise ValueError(
        "Unable to create temporal CV folds with at least one positive in both train and test. "
        "Consider fewer splits, smaller gap, or checking class balance."
    )


def temporal_cv_train(
    df_train: pd.DataFrame,
    target_col: str,
    timestamp_col: str,
    n_splits: int = 5,
    gap: int = 5,
    random_state: int = 42,
) -> Dict[str, Any]:
    if df_train[timestamp_col].isna().any():
        raise ValueError(f"Column '{timestamp_col}' contains NaT values; cannot perform temporal CV.")

    X, feature_names = build_feature_matrix(df_train, timestamp_col=timestamp_col, target_col=target_col)
    y = df_train[target_col].astype("int64").to_numpy()

    pipe = build_pipeline(random_state=random_state)
    cv_splits, cv_pos_counts, effective_splits = _build_temporal_splits(
        y,
        n_splits=n_splits,
        gap=gap,
    )
    gs = GridSearchCV(
        estimator=pipe,
        param_grid=param_grid(),
        scoring={"average_precision": "average_precision", "roc_auc": "roc_auc"},
        refit="average_precision",
        cv=cv_splits,
        n_jobs=1,
        verbose=0,
        return_train_score=False,
        error_score="raise",
    )
    gs.fit(X, y)

    best_pipe = gs.best_estimator_
    y_prob = best_pipe.predict_proba(X)[:, 1]

    oof_prob = np.full(shape=y.shape, fill_value=np.nan, dtype=float)
    for train_idx, test_idx in cv_splits:
        if len(test_idx) == 0:
            continue
        fold_pipe: Pipeline = clone(best_pipe)
        fold_pipe.fit(X.iloc[train_idx], y[train_idx])
        oof_prob[test_idx] = fold_pipe.predict_proba(X.iloc[test_idx])[:, 1]

    valid_mask = ~np.isnan(oof_prob)
    if not np.any(valid_mask):
        raise ValueError(
            "Unable to compute out-of-fold probabilities for threshold selection; "
            "check cross-validation splits."
        )

    threshold_raw = find_optimal_threshold(y[valid_mask], oof_prob[valid_mask])
    selected_threshold = float(threshold_raw["threshold"])
    threshold_info = {
        "threshold": selected_threshold,
        "objective": "f_beta",
        "beta": float(threshold_raw["beta"]),
        "score": float(threshold_raw["fbeta"]),
        "source": "temporal_cv_oof",
        "n_oof_predictions": int(valid_mask.sum()),
    }

    in_sample_metrics = compute_metrics(y, y_prob, threshold=selected_threshold)

    best_idx = gs.best_index_
    cv_metrics = {
        "average_precision": float(gs.cv_results_["mean_test_average_precision"][best_idx]),
        "roc_auc": float(gs.cv_results_["mean_test_roc_auc"][best_idx]),
    }

    return {
        "best_estimator": best_pipe,
        "cv_results_": gs.cv_results_,
        "best_params_": gs.best_params_,
        "best_score_": float(gs.best_score_),
        "feature_names": feature_names,
        "train_metrics": in_sample_metrics.to_dict(),
        "in_sample_metrics": in_sample_metrics.to_dict(),
        "cv_metrics": cv_metrics,
        "cv_fold_positive_counts": cv_pos_counts,
        "effective_n_splits": effective_splits,
        "selected_threshold": selected_threshold,
        "threshold_info": threshold_info,
    }

def save_artifacts(artifacts_dir: Path | str, model, feature_names, metadata: Dict[str, Any]) -> None:
    artifacts_dir = Path(artifacts_dir)
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, artifacts_dir / "model.joblib")
    (artifacts_dir / "feature_names.json").write_text(json.dumps(feature_names, indent=2), encoding="utf-8")
    (artifacts_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

def evaluate_on(
    df: pd.DataFrame,
    target_col: Optional[str],
    timestamp_col: str,
    artifacts_dir: Path | str,
    *,
    plot_dir: Path | str | None = None,
    plot_prefix: Optional[str] = None,
) -> Dict[str, Any]:
    artifacts_dir = Path(artifacts_dir)
    model = joblib.load(artifacts_dir / "model.joblib")
    feature_names = json.loads((artifacts_dir / "feature_names.json").read_text(encoding="utf-8"))
    metadata_path = artifacts_dir / "metadata.json"
    metadata: Dict[str, Any] = {}
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

    selected_threshold = float(metadata.get("selected_threshold", 0.5))
    threshold_info = metadata.get("threshold_selection")
    if isinstance(threshold_info, dict) and "threshold" in threshold_info:
        selected_threshold = float(threshold_info.get("threshold", selected_threshold))

    # Build features and align to training schema
    X_new, _ = build_feature_matrix(df, timestamp_col=timestamp_col, target_col=target_col)
    X_new = X_new.reindex(columns=feature_names)
    if X_new.isna().any().any():
        raise ValueError("X_new contains NaNs after alignment; check feature engineering.")

    y_prob = model.predict_proba(X_new)[:, 1]

    y_pred = (y_prob >= selected_threshold).astype(int)

    out: Dict[str, Any] = {
        "y_prob": y_prob.tolist(),
        "y_pred": y_pred.tolist(),
        "selected_threshold": selected_threshold,
    }
    if isinstance(threshold_info, dict):
        out["threshold_selection"] = threshold_info

    if target_col and target_col in df.columns:
        y_true = df[target_col].astype("int64").to_numpy()
        metrics = compute_metrics(y_true, y_prob, threshold=selected_threshold)
        out["metrics"] = metrics.to_dict()

        if plot_dir:
            prefix = plot_prefix or "eval"
            out["plots"] = plot_probability_curves(
                y_true,
                y_prob,
                out_dir=plot_dir,
                prefix=prefix,
            )
    return out
