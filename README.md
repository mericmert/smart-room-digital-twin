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
