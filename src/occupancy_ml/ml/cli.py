from __future__ import annotations
import logging, random
import argparse
from datetime import datetime

import numpy as np
from .dataio import read_occ
from .train import temporal_cv_train, save_artifacts, evaluate_on
from pathlib import Path
from typing import Tuple

logger = logging.getLogger(__name__)

TARGET_COLUMN = "Occupancy"

TIMESTAMP_COLUMN = "date"

EXPECTED_COLUMNS: Tuple[str, ...] = (
    TIMESTAMP_COLUMN, 
    "Temperature", "Humidity", "Light", "CO2", "HumidityRatio",
    TARGET_COLUMN
)

NUMERIC_FEATURES: Tuple[str, ...] = (
    "Temperature", "Humidity", "Light", "CO2", "HumidityRatio"
)

def _configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

def set_seeds(seed: int = 42) -> None:
    np.random.seed(seed)
    random.seed(seed)
    
def cli_train() -> None:
    p = argparse.ArgumentParser(description="Train occupancy model with temporal CV and export artifacts")
    p.add_argument("--data", required=True, type=Path, help="Path to data")
    p.add_argument("--artifact-dir", required=True, type=Path, help="Directory to write artifacts")
    p.add_argument("--n-splits", type=int, default=5)
    p.add_argument("--gap", type=int, default=5)
    args = p.parse_args()
    
    _configure_logging()
    set_seeds(42)
    
    df_train = read_occ(
        args.data,
        TARGET_COLUMN,
        TIMESTAMP_COLUMN,
        expected_columns=EXPECTED_COLUMNS,
        numeric_features=NUMERIC_FEATURES
    )
    
    logger.info("Fitting model...")
    
    result = temporal_cv_train(
        df_train=df_train,
        target_col=TARGET_COLUMN,
        timestamp_col=TIMESTAMP_COLUMN,
        n_splits=args.n_splits,
        gap=args.gap,
        random_state=42,
    )

    metadata = {
        # Required fields for ModelMetadata validation
        "model_version": "v1.0",
        "training_date": datetime.now().isoformat(),
        "feature_names": result["feature_names"],
        "model_type": type(result["best_estimator"]).__name__,
        "performance_metrics": result["train_metrics"],
        
        # Additional training metadata
        "best_params": result["best_params_"],
        "best_cv_average_precision": result["best_score_"],
        "train_metrics": result["train_metrics"],
        "n_requested_splits": args.n_splits,
        "effective_n_splits": result["effective_n_splits"],
        "cv_fold_positive_counts": result["cv_fold_positive_counts"],
        "gap": args.gap,
        "random_state": 42,
        "selected_threshold": result["selected_threshold"],
        "threshold_selection": result["threshold_info"],
    }

    save_artifacts(args.artifact_dir, result["best_estimator"], result["feature_names"], metadata)
    logger.info("Artifacts saved to %s", args.artifact_dir)
    
def cli_eval() -> None:
    p = argparse.ArgumentParser(description="Evaluate an exported occupancy model on a dataset")
    p.add_argument("--data", required=True, type=Path, help="Path to CSV/TSV file to evaluate")
    p.add_argument("--artifacts", required=True, type=Path, help="Artifacts directory from training")
    p.add_argument(
        "--out",
        required=True,
        type=Path,
        help="Directory or file where predictions CSV, metrics, and plots will be written",
    )
    args = p.parse_args()

    _configure_logging()
    df = read_occ(
        args.data,
        timestamp_col=TIMESTAMP_COLUMN,
        target_col=TARGET_COLUMN,
        expected_columns=EXPECTED_COLUMNS,
        numeric_features=NUMERIC_FEATURES
    )
    pred_out_path = args.out
    if pred_out_path.suffix:
        output_dir = pred_out_path.parent
    else:
        output_dir = pred_out_path
        pred_out_path = output_dir / f"{args.data.stem}_predictions.csv"

    output_dir.mkdir(parents=True, exist_ok=True)

    eval_out = evaluate_on(
        df,
        target_col=TARGET_COLUMN,
        timestamp_col=TIMESTAMP_COLUMN,
        artifacts_dir=args.artifacts,
        plot_dir=output_dir,
        plot_prefix=args.data.stem,
    )

    import pandas as pd
    out_df = pd.DataFrame({
        TIMESTAMP_COLUMN: df[TIMESTAMP_COLUMN],
        "y_prob": eval_out["y_prob"],
    })
    if "y_pred" in eval_out:
        out_df["y_pred"] = eval_out["y_pred"]
    if TARGET_COLUMN in df.columns:
        out_df[TARGET_COLUMN] = df[TARGET_COLUMN].to_numpy()
    out_df.to_csv(pred_out_path, index=False)
    logger.info("Predictions saved to %s", pred_out_path)

    import json
    if "metrics" in eval_out:
        metrics_path = output_dir / f"{pred_out_path.stem}_metrics.json"
        metrics_path.write_text(json.dumps(eval_out["metrics"], indent=2), encoding="utf-8")
        logger.info("Metrics saved to %s", metrics_path)
        if "selected_threshold" in eval_out:
            logger.info(
                "Decision threshold used for metrics: %.4f",
                eval_out["selected_threshold"],
            )
        if "plots" in eval_out:
            logger.info("Saved diagnostic plots: %s", eval_out["plots"])
    else:
        print("Predictions computed. (No metrics—no target provided.)")
    
