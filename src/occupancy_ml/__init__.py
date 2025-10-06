"""Occupancy ML package with separated API and ML layers."""

from .api import app
from .ml.version import __version__

__all__ = [
    "app",
    "__version__",
]