"""ML model data structures."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ModelBundle:
    """Container for ML model and its feature names."""
    model: Any
    feature_names: list[str]