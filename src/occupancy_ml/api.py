"""FastAPI app exposing the trained occupancy classifier."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .features import build_feature_matrix


TIMESTAMP_COLUMN = "date"
_env_dir = os.environ.get("OCC_MODEL_DIR")
if _env_dir:
    DEFAULT_ARTIFACT_DIR = Path(_env_dir).expanduser()
else:
    DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "occ_v1"


@dataclass(frozen=True)
class ModelBundle:
    model: Any
    feature_names: list[str]


def _load_artifacts(artifact_dir: Path) -> ModelBundle:
    if not artifact_dir.exists():
        raise FileNotFoundError(f"Artifact directory not found: {artifact_dir}")

    model_path = artifact_dir / "model.joblib"
    feature_path = artifact_dir / "feature_names.json"
    if not model_path.exists() or not feature_path.exists():
        raise FileNotFoundError(f"Expected model artifacts in {artifact_dir}.")

    model = joblib.load(model_path)
    feature_names = json.loads(feature_path.read_text(encoding="utf-8"))
    return ModelBundle(model=model, feature_names=feature_names)


_bundle = _load_artifacts(Path(DEFAULT_ARTIFACT_DIR))


class OccupancyRequest(BaseModel):
    date: datetime = Field(..., description="Timestamp of the observation")
    Temperature: float = Field(..., description="Room temperature in Celsius")
    Humidity: float = Field(..., description="Relative humidity percentage")
    Light: float = Field(..., description="Light level in lux")
    CO2: float = Field(..., description="CO2 concentration in ppm")
    HumidityRatio: float = Field(..., description="Absolute humidity ratio")


class OccupancyResponse(BaseModel):
    occupancy: int = Field(..., description="Predicted occupancy class (1=occupied, 0=vacant)")
    probability: float = Field(..., ge=0.0, le=1.0, description="Model probability of occupancy")


app = FastAPI(title="Occupancy Predictor", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict", response_model=OccupancyResponse)
def predict(request: OccupancyRequest) -> OccupancyResponse:
    record = request.dict()
    record[TIMESTAMP_COLUMN] = pd.to_datetime(record[TIMESTAMP_COLUMN], errors="coerce")
    if pd.isna(record[TIMESTAMP_COLUMN]):
        raise HTTPException(status_code=422, detail="Invalid datetime provided for 'date'.")

    df = pd.DataFrame([record])
    feature_frame, _ = build_feature_matrix(df, timestamp_col=TIMESTAMP_COLUMN, target_col=None)
    feature_frame = feature_frame.reindex(columns=_bundle.feature_names)

    if feature_frame.isna().any().any():
        raise HTTPException(status_code=400, detail="NaN values encountered after feature engineering.")

    prob = float(_bundle.model.predict_proba(feature_frame)[:, 1][0])
    pred = int(_bundle.model.predict(feature_frame)[0])

    return OccupancyResponse(occupancy=pred, probability=prob)
