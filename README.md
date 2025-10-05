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
  --data data/datatraining.txt \
  --artifact-dir artifacts/occ_v1 \
  --n-splits 5 \
  --gap 5
```

Evaluate on a separate holdout (with optional diagnostics):
```bash
occ-ml-eval \
  --data data/datatest.txt \
  --artifacts artifacts/occ_v1 \
  --out evaluation/
```

Artifacts saved:
- `model.joblib` — fitted pipeline
- `features.json` — feature list used by the model
- `threshold.json` — operating threshold chosen via OOF predictions
- `metrics_train_cv.json` — CV metrics (AP, ROC-AUC, Brier)
- `metrics_*.json` — test/holdout metrics
- `pr_curve_*.png`, `roc_curve_*.png`, `calibration_*.png`
