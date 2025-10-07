"""FastAPI route handlers for the occupancy ML API."""

import logging
import os
from datetime import datetime
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, status

from ..config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_TOPIC
from .models import OccupancyRequest, OccupancyResponse, EnhancedOccupancyResponse, HealthResponse
from ..ml.prediction import predict_occupancy, predict_occupancy_enhanced
from ..ml.model_manager import get_model_manager

logger = logging.getLogger(__name__)

# Create router for API endpoints
router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Health check endpoint with model status."""
    try:
        model_manager = get_model_manager()
        model_status = model_manager.get_health_status()
        
        # Check if Kafka is enabled
        kafka_bootstrap_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
        kafka_enabled = os.environ.get("ENABLE_KAFKA", "false").lower() == "true"
        
        logger.info(f"Health check: model_loaded={model_status['model_loaded']}, kafka_enabled={kafka_enabled}")
        
        return HealthResponse(
            status="ok" if model_status['model_loaded'] else "degraded",
            kafka_consumer="running" if kafka_enabled else "disabled",
            kafka_topic=KAFKA_TOPIC,
            kafka_bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="error",
            kafka_consumer="error",
            kafka_topic=KAFKA_TOPIC,
            kafka_bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS
        )


@router.get("/test")
def test_endpoint() -> Dict[str, Any]:
    """Simple test endpoint to verify API is working."""
    return {
        "message": "ML API is working!",
        "timestamp": datetime.now().isoformat(),
        "environment": {
            "debug": os.environ.get("DEBUG", "not set"),
            "log_level": os.environ.get("LOG_LEVEL", "not set"),
            "kafka_enabled": os.environ.get("ENABLE_KAFKA", "not set")
        }
    }


@router.get("/health/detailed")
def health_detailed() -> Dict[str, Any]:
    """Detailed health check endpoint with comprehensive status."""
    model_manager = get_model_manager()
    model_status = model_manager.get_health_status()
    
    # Check if Kafka is enabled
    kafka_bootstrap_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    kafka_enabled = os.environ.get("ENABLE_KAFKA", "false").lower() == "true"
    
    return {
        "api_status": "ok",
        "kafka": {
            "consumer": "running" if kafka_enabled else "disabled",
            "topic": KAFKA_TOPIC,
            "bootstrap_servers": KAFKA_BOOTSTRAP_SERVERS
        },
        "model": model_status
    }


@router.post("/predict", response_model=OccupancyResponse)
def predict(request: OccupancyRequest) -> OccupancyResponse:
    """Predict occupancy from sensor data."""
    try:
        # Convert Pydantic model to dict for processing
        request_data = request.dict()
        
        # Make prediction
        pred, prob = predict_occupancy(request_data)
        
        return OccupancyResponse(occupancy=pred, probability=prob)
        
    except ValueError as e:
        logger.warning(f"Validation error in prediction request: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Validation error",
                "message": str(e),
                "error_type": "validation_error"
            }
        )
    except RuntimeError as e:
        logger.error(f"Model not available: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Model not available",
                "message": str(e),
                "error_type": "model_unavailable"
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Internal server error",
                "message": "An unexpected error occurred",
                "error_type": "internal_error"
            }
        )


@router.post("/predict-enhanced", response_model=EnhancedOccupancyResponse)
def predict_enhanced(request: OccupancyRequest) -> EnhancedOccupancyResponse:
    """Enhanced occupancy prediction with anomaly detection."""
    try:
        # Convert Pydantic model to dict for processing
        request_data = request.dict()
        
        # Make enhanced prediction with anomaly detection
        result = predict_occupancy_enhanced(request_data)
        
        return EnhancedOccupancyResponse(**result)
        
    except ValueError as e:
        logger.warning(f"Validation error in enhanced prediction request: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Validation error",
                "message": str(e),
                "error_type": "validation_error"
            }
        )
    except RuntimeError as e:
        logger.error(f"Model not available: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Model not available",
                "message": str(e),
                "error_type": "model_unavailable"
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error in enhanced prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Internal server error",
                "message": "An unexpected error occurred",
                "error_type": "internal_error"
            }
        )


@router.post("/prediction-result", response_model=EnhancedOccupancyResponse)
def receivePredictionResult(result_data: Dict[str, Any]) -> EnhancedOccupancyResponse:
    """Receive processed prediction results from the processing pipeline."""
    try:
        # Validate that the result contains required fields
        required_fields = ['features', 'prob', 'occupancy', 'is_anomaly']
        for field in required_fields:
            if field not in result_data:
                raise ValueError(f"Missing required field: {field}")
        
        # Create response from prediction result
        return EnhancedOccupancyResponse(**result_data)
        
    except ValueError as e:
        logger.warning(f"Validation error in prediction result: {e}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Validation error",
                "message": str(e),
                "error_type": "validation_error"
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error processing prediction result: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Internal server error",
                "message": "An unexpected error occurred",
                "error_type": "internal_error"
            }
        )