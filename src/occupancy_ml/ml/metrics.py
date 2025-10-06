
from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
import numpy as np
from sklearn.metrics import (
    average_precision_score, roc_auc_score,
    precision_score, recall_score, f1_score, confusion_matrix,
    precision_recall_curve, roc_curve,
    balanced_accuracy_score, matthews_corrcoef
)
from typing import Dict, Any, Tuple
import matplotlib

matplotlib.use("Agg")  # use the non-GUI backend
import matplotlib.pyplot as plt

@dataclass
class ClassifMetrics:
    average_precision: float
    roc_auc: float
    precision: float
    recall: float
    f1: float
    specificity: float
    balanced_accuracy: float
    mcc: float
    accuracy: float
    prevalence: float
    tn: int
    fp: int
    fn: int
    tp: int
    threshold: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

def _validate_inputs(y_true: np.ndarray, y_prob: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    y_true = np.asarray(y_true).astype(int).ravel()
    y_prob = np.asarray(y_prob).astype(float).ravel()
    if y_true.shape != y_prob.shape:
        raise ValueError(f"Shape mismatch: y_true {y_true.shape} vs y_prob {y_prob.shape}")
    if np.isnan(y_prob).any() or np.isnan(y_true).any():
        raise ValueError("NaNs detected in inputs.")
    unique = np.unique(y_true)
    if not np.all(np.isin(unique, [0, 1])):
        raise ValueError(f"y_true must be binary {{0,1}}; got values {unique}.")
    return y_true, y_prob

def compute_metrics(y_true: np.ndarray, y_prob: np.ndarray, threshold: float = 0.5) -> ClassifMetrics:
    y_true, y_prob = _validate_inputs(y_true, y_prob)
    y_pred = (y_prob >= threshold).astype(int)

    ap = float(average_precision_score(y_true, y_prob))
    try:
        auc = float(roc_auc_score(y_true, y_prob))
    except ValueError:
        auc = float("nan")

    prec = float(precision_score(y_true, y_pred, zero_division=0))
    rec = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()

    specificity = float(tn / (tn + fp)) if (tn + fp) else float("nan")
    bal_acc = float(balanced_accuracy_score(y_true, y_pred))
    mcc = float(matthews_corrcoef(y_true, y_pred)) if tp+tn+fp+fn else float("nan")
    accuracy = float((tp + tn) / (tp + tn + fp + fn))
    prevalence = float((tp + fn) / (tp + tn + fp + fn))

    return ClassifMetrics(
        ap, auc, prec, rec, f1,
        specificity, bal_acc, mcc, accuracy, prevalence,
        int(tn), int(fp), int(fn), int(tp),
        float(threshold)
    )


def find_optimal_threshold(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    *,
    beta: float = 1.0,
) -> Dict[str, float]:
    """Return the probability threshold that maximizes the F-beta score."""
    if beta <= 0:
        raise ValueError("beta must be positive when selecting an F-beta threshold.")

    y_true_arr, y_prob_arr = _validate_inputs(y_true, y_prob)
    precision, recall, thresholds = precision_recall_curve(y_true_arr, y_prob_arr)

    if thresholds.size == 0:
        return {
            "threshold": float(0.5),
            "fbeta": float("nan"),
            "beta": float(beta),
        }

    prec = precision[1:]
    rec = recall[1:]

    beta_sq = beta ** 2
    denom = beta_sq * prec + rec
    with np.errstate(divide="ignore", invalid="ignore"):
        fbeta = np.where(denom > 0, (1 + beta_sq) * prec * rec / denom, 0.0) # F-β formula

    best_idx = int(np.nanargmax(fbeta))
    best_threshold = float(thresholds[best_idx])
    best_score = float(fbeta[best_idx])

    return {
        "threshold": best_threshold,
        "fbeta": best_score,
        "beta": float(beta),
    }


def plot_probability_curves(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    out_dir: Path | str,
    prefix: str,
    *,
    show_numbers: bool = True
) -> Dict[str, str]:
    y_true, y_prob = _validate_inputs(y_true, y_prob)

    output_dir = Path(out_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    pr_precision, pr_recall, _ = precision_recall_curve(y_true, y_prob)
    roc_fpr, roc_tpr, _ = roc_curve(y_true, y_prob)
    ap = average_precision_score(y_true, y_prob)
    auc = roc_auc_score(y_true, y_prob)
    prevalence = (y_true == 1).mean()

    pr_png = output_dir / f"{prefix}_pr_curve.png"
    roc_png = output_dir / f"{prefix}_roc_curve.png"

    # PR
    fig, ax = plt.subplots()
    ax.plot(pr_recall, pr_precision, label=f"PR curve{f' (AP={ap:.3f})' if show_numbers else ''}")
    ax.hlines(prevalence, 0, 1, linestyles="--", alpha=0.6, label=f"Baseline={prevalence:.3f}")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
    ax.set_title("Precision–Recall Curve")
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.legend(loc="lower left")
    fig.tight_layout(); fig.savefig(pr_png, dpi=200); plt.close(fig)

    # ROC
    fig, ax = plt.subplots()
    ax.plot(roc_fpr, roc_tpr, label=f"ROC curve{f' (AUC={auc:.3f})' if show_numbers else ''}")
    ax.plot([0, 1], [0, 1], linestyle="--", alpha=0.7, label="Chance")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1)
    ax.set_xlabel("False Positive Rate"); ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curve")
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.legend(loc="lower right")
    fig.tight_layout(); fig.savefig(roc_png, dpi=200); plt.close(fig)

    return {"pr_curve_png": str(pr_png), "roc_curve_png": str(roc_png)}
