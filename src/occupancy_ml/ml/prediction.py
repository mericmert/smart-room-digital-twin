"""ML prediction logic - simplified interface using ModelManager."""

import logging
from typing import Dict, Any

from .model_manager import get_model_manager

logger = logging.getLogger(__name__)


def process_sensor_data(sensor_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process sensor data through the trained ML model.
    
    Args:
        sensor_data: Sensor data dictionary
        
    Returns:
        Dict containing prediction results
    """
    model_manager = get_model_manager()
    return model_manager.predict(sensor_data)


def predict_occupancy(request_data: Dict[str, Any]) -> tuple[int, float]:
    """
    Make occupancy prediction from request data.
    
    Args:
        request_data: Request data from API
        
    Returns:
        Tuple of (prediction, probability)
        
    Raises:
        ValueError: If input validation fails
        RuntimeError: If model not loaded
    """
    model_manager = get_model_manager()
    return model_manager.predict_from_request(request_data)


def get_model_bundle():
    """
    Get the model bundle (deprecated - use get_model_manager instead).
    
    This function is kept for backward compatibility.
    """
    logger.warning("get_model_bundle() is deprecated. Use get_model_manager() instead.")
    model_manager = get_model_manager()
    return model_manager.get_model_bundle()
