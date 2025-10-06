
from __future__ import annotations
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from typing import List, Dict, Any
import numpy as np

def build_pipeline(random_state: int = 42) -> Pipeline:
    return Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler(with_mean=True, with_std=True)),
        (
            "clf",
            LogisticRegression(
                max_iter=10000,
                class_weight="balanced",
                random_state=random_state,
            ),
        ),
    ])

def param_grid() -> List[Dict[str, Any]]:
    C_grid = np.logspace(-2, 2, 5)
    return [
        {
            "clf__solver": ["liblinear"],
            "clf__penalty": ["l1", "l2"],
            "clf__C": C_grid,
        },
        {
            "clf__solver": ["saga"],
            "clf__penalty": ["l1", "l2"],
            "clf__C": C_grid,
        },
        {
            "clf__solver": ["saga"],
            "clf__penalty": ["elasticnet"],
            "clf__l1_ratio": [0.1, 0.5, 0.9],
            "clf__C": C_grid,
        },
    ]
