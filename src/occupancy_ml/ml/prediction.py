"""Enhanced ML prediction logic with anomaly detection."""

import logging
from datetime import datetime
from typing import Dict, Any, Tuple
import pandas as pd

from .model_manager import get_model_manager
from .anomaly_detection import AnomalyDetector

logger = logging.getLogger(__name__)


class EnhancedPredictionProcessor:
    """Enhanced prediction processor with anomaly detection."""
    
    def __init__(self):
        self.model_manager = get_model_manager()
        self.anomaly_detector = None
        self._initialize_anomaly_detector()
        
    def _initialize_anomaly_detector(self):
        """Initialize the anomaly detector."""
        try:
            # Initialize anomaly detector with combined method
            self.anomaly_detector = AnomalyDetector(
                method="combined",
                contamination=0.1,
                z_threshold=3.0,
                iqr_multiplier=1.5
            )
            logger.info("Anomaly detector initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize anomaly detector: {e}")
            self.anomaly_detector = None
    
    def _detect_anomaly(self, sensor_data: Dict[str, Any]) -> bool:
        """Detect if sensor data contains anomalies."""
        if not self.anomaly_detector:
            logger.warning("Anomaly detector not available, skipping anomaly detection")
            return False
            
        try:
            # Convert sensor data to DataFrame format
            numeric_cols = ['Temperature', 'Humidity', 'Light', 'CO2', 'HumidityRatio']
            record = {
                'Temperature': float(sensor_data.get('Temperature', 0)),
                'Humidity': float(sensor_data.get('Humidity', 0)),
                'Light': float(sensor_data.get('Light', 0)),
                'CO2': float(sensor_data.get('CO2', 0)),
                'HumidityRatio': float(sensor_data.get('HumidityRatio', 0))
            }
            
            df = pd.DataFrame([record])
            
            # Use domain-based anomaly detection since we don't have training data
            # Check for obvious outliers using domain thresholds
            domain_thresholds = {
                "Temperature": {"min": 10, "max": 40},
                "Humidity": {"min": 0, "max": 100},
                "Light": {"min": 0, "max": 2000},
                "CO2": {"min": 300, "max": 2000},
                "HumidityRatio": {"min": 0, "max": 0.02}
            }
            
            is_anomaly = False
            for col, thresholds in domain_thresholds.items():
                value = record[col]
                if value < thresholds["min"] or value > thresholds["max"]:
                    logger.debug(f"Domain anomaly detected in {col}: {value} outside [{thresholds['min']}, {thresholds['max']}]")
                    is_anomaly = True
                    break
            
            logger.debug(f"Anomaly detection result: {is_anomaly}")
            return is_anomaly
            
        except Exception as e:
            logger.error(f"Error in anomaly detection: {e}")
            return False
    
    def predict_with_anomaly_detection(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make occupancy prediction with anomaly detection.
        
        Args:
            request_data: Request data from API
            
        Returns:
            Dict containing comprehensive prediction results
        """
        try:
            # Extract features for processing
            features = {
                'timestamp': request_data.get('date', datetime.now()).isoformat() if isinstance(request_data.get('date'), datetime) else str(request_data.get('date', datetime.now())),
                'Temperature': float(request_data.get('Temperature', 0)),
                'Humidity': float(request_data.get('Humidity', 0)),
                'Light': float(request_data.get('Light', 0)),
                'CO2': float(request_data.get('CO2', 0)),
                'HumidityRatio': float(request_data.get('HumidityRatio', 0))
            }
            
            # Detect anomalies
            is_anomaly = self._detect_anomaly(features)
            
            # Make occupancy prediction
            prediction_result = self.model_manager.predict(features)
            
            # Extract prediction details
            occupancy = prediction_result.get('occupancy', -1)
            probability = prediction_result.get('probability', 0.0)
            
            result = {
                'features': features,
                'prob': probability,
                'occupancy': occupancy,
                'is_anomaly': is_anomaly,
                'timestamp': datetime.now().isoformat(),
                'status': prediction_result.get('status', 'unknown'),
                'model_version': prediction_result.get('model_version', 'unknown')
            }
            
            # Add error information if prediction failed
            if prediction_result.get('status') == 'error':
                result['error'] = prediction_result.get('error', 'Unknown error')
                result['error_type'] = prediction_result.get('error_type', 'unknown')
            
            logger.info(f"Enhanced prediction - Occupancy: {occupancy}, Probability: {probability:.3f}, Anomaly: {is_anomaly}")
            return result
            
        except Exception as e:
            logger.error(f"Error in enhanced prediction: {e}")
            return {
                'features': request_data,
                'prob': 0.0,
                'occupancy': -1,
                'is_anomaly': False,
                'timestamp': datetime.now().isoformat(),
                'status': 'error',
                'error': str(e),
                'error_type': 'prediction_error'
            }


# Global enhanced processor instance
_enhanced_processor = None


def get_enhanced_processor() -> EnhancedPredictionProcessor:
    """Get the global enhanced prediction processor instance."""
    global _enhanced_processor
    if _enhanced_processor is None:
        _enhanced_processor = EnhancedPredictionProcessor()
    return _enhanced_processor


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


def predict_occupancy_enhanced(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Make enhanced occupancy prediction with anomaly detection.
    
    Args:
        request_data: Request data from API
        
    Returns:
        Dict containing comprehensive prediction results including anomaly detection
    """
    processor = get_enhanced_processor()
    return processor.predict_with_anomaly_detection(request_data)


def get_model_bundle():
    """
    Get the model bundle (deprecated - use get_model_manager instead).
    
    This function is kept for backward compatibility.
    """
    logger.warning("get_model_bundle() is deprecated. Use get_model_manager() instead.")
    model_manager = get_model_manager()
    return model_manager.get_model_bundle()
