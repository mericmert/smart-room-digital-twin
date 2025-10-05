# occupancy-ml

A minimal, production-friendly package + CLI for time-series occupancy prediction with:
- Temporal cross-validation
- Out-of-fold (OOF) threshold selection
- Calibration curve & Brier score
- Clean logging, reproducible seeds
- Saved artifacts and metrics

## Install (editable)

```bash
pip install -e .
```

## Usage

Train with temporal CV and export artifacts:
```bash
occ-ml-train \
  --train-txt data/datatraining.txt \
  --timestamp date \
  --artifact-dir ./out_artifacts \
  --target Occupancy
```

Evaluate on a separate holdout (with optional diagnostics):
```bash
occ-ml-eval \
  --data data/datatest.txt \
  --timestamp date \
  --artifacts ./out_artifacts \
  --target Occupancy \
  --plot-dir ./out_artifacts/plots
```

Artifacts saved:
- `model.joblib` — fitted pipeline
- `features.json` — feature list used by the model
- `threshold.json` — operating threshold chosen via OOF predictions
- `metrics_train_cv.json` — CV metrics (AP, ROC-AUC, Brier)
- `metrics_*.json` — test/holdout metrics
- `pr_curve_*.png`, `roc_curve_*.png`, `calibration_*.png`
