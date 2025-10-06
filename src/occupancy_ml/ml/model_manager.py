"""Enhanced model manager with proper lifecycle management and validation."""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional, List
from contextlib import asynccontextmanager

import joblib
import pandas as pd
from pydantic import BaseModel, Field

from ..config import DEFAULT_ARTIFACT_DIR, TIMESTAMP_COLUMN
from .features import build_feature_matrix
from .models import ModelBundle

logger = logging.getLogger(__name__)


class ModelMetadata(BaseModel):
    """Model metadata validation schema."""
    model_version: str = Field(..., description="Model version identifier")
    training_date: datetime = Field(..., description="When the model was trained")
    feature_names: List[str] = Field(..., description="Expected feature names")
    model_type: str = Field(..., description="Type of ML model")
    performance_metrics: Dict[str, float] = Field(default_factory=dict, description="Model performance metrics")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ModelManager:
    """Manages ML model lifecycle with proper validation and error handling."""
    
    def __init__(self, artifact_dir: Optional[Path] = None):
        self.artifact_dir = artifact_dir or DEFAULT_ARTIFACT_DIR
        self._model_bundle: Optional[ModelBundle] = None
        self._metadata: Optional[ModelMetadata] = None
        self._is_loaded = False
        self._load_error: Optional[str] = None
        
    @property
    def is_loaded(self) -> bool:
        """Check if model is successfully loaded."""
        return self._is_loaded
    
    @property
    def load_error(self) -> Optional[str]:
        """Get the last load error if any."""
        return self._load_error
    
    @property
    def metadata(self) -> Optional[ModelMetadata]:
        """Get model metadata."""
        return self._metadata
    
    def load_model(self) -> bool:
        """
        Load model and metadata with comprehensive validation.
        
        Returns:
            bool: True if model loaded successfully, False otherwise
        """
        try:
            logger.info(f"Loading model from {self.artifact_dir}")
            
            # Validate artifact directory exists
            if not self.artifact_dir.exists():
                raise FileNotFoundError(f"Artifact directory not found: {self.artifact_dir}")
            
            # Load metadata first
            metadata_path = self.artifact_dir / "metadata.json"
            if not metadata_path.exists():
                raise FileNotFoundError(f"Model metadata not found: {metadata_path}")
            
            metadata_dict = json.loads(metadata_path.read_text(encoding="utf-8"))
            self._metadata = ModelMetadata(**metadata_dict)
            
            # Load feature names
            feature_path = self.artifact_dir / "feature_names.json"
            if not feature_path.exists():
                raise FileNotFoundError(f"Feature names not found: {feature_path}")
            
            feature_names = json.loads(feature_path.read_text(encoding="utf-8"))
            
            # Validate feature names match metadata
            if set(feature_names) != set(self._metadata.feature_names):
                logger.warning("Feature names mismatch between metadata and feature_names.json")
            
            # Load model
            model_path = self.artifact_dir / "model.joblib"
            if not model_path.exists():
                raise FileNotFoundError(f"Model file not found: {model_path}")
            
            model = joblib.load(model_path)
            
            # Validate model has required methods
            if not hasattr(model, 'predict') or not hasattr(model, 'predict_proba'):
                raise ValueError("Model must have 'predict' and 'predict_proba' methods")
            
            # Create model bundle
            self._model_bundle = ModelBundle(model=model, feature_names=feature_names)
            
            # Test model with dummy data to ensure it works
            self._validate_model_functionality()
            
            self._is_loaded = True
            self._load_error = None
            
            logger.info(f"Model loaded successfully. Version: {self._metadata.model_version}")
            logger.info(f"Model trained on: {self._metadata.training_date}")
            logger.info(f"Features: {len(feature_names)}")
            
            return True
            
        except Exception as e:
            error_msg = f"Failed to load model: {str(e)}"
            logger.error(error_msg)
            self._load_error = error_msg
            self._is_loaded = False
            self._model_bundle = None
            self._metadata = None
            return False
    
    def _validate_model_functionality(self) -> None:
        """Validate that the loaded model works with expected features."""
        if not self._model_bundle:
            raise ValueError("Model bundle not loaded")
        
        # Create dummy data with all expected features
        dummy_data = {}
        for feature in self._model_bundle.feature_names:
            if feature == TIMESTAMP_COLUMN:
                dummy_data[feature] = pd.Timestamp.now()
            else:
                dummy_data[feature] = 0.0
        
        df = pd.DataFrame([dummy_data])
        
        try:
            # Test prediction
            pred = self._model_bundle.model.predict(df)
            prob = self._model_bundle.model.predict_proba(df)
            
            if len(pred) != 1 or prob.shape[0] != 1:
                raise ValueError("Model prediction output shape mismatch")
                
        except Exception as e:
            raise ValueError(f"Model validation failed: {str(e)}")
    
    def get_model_bundle(self) -> ModelBundle:
        """Get the loaded model bundle."""
        if not self._is_loaded or not self._model_bundle:
            raise RuntimeError("Model not loaded. Call load_model() first.")
        return self._model_bundle
    
    def predict(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make prediction with comprehensive error handling.
        
        Args:
            sensor_data: Input sensor data
            
        Returns:
            Dict containing prediction results or error information
        """
        if not self._is_loaded:
            return {
                'timestamp': datetime.now().isoformat(),
                'occupancy': -1,
                'probability': 0.0,
                'sensor_data': sensor_data,
                'status': 'error',
                'error': 'Model not loaded',
                'error_type': 'model_not_loaded'
            }
        
        try:
            model_bundle = self.get_model_bundle()
            
            # Convert sensor data to DataFrame format
            record = {
                TIMESTAMP_COLUMN: pd.to_datetime(sensor_data.get('timestamp', datetime.now())),
                'Temperature': float(sensor_data.get('Temperature', 0)),
                'Humidity': float(sensor_data.get('Humidity', 0)),
                'Light': float(sensor_data.get('Light', 0)),
                'CO2': float(sensor_data.get('CO2', 0)),
                'HumidityRatio': float(sensor_data.get('HumidityRatio', 0))
            }
            
            df = pd.DataFrame([record])
            feature_frame, _ = build_feature_matrix(df, timestamp_col=TIMESTAMP_COLUMN, target_col=None)
            feature_frame = feature_frame.reindex(columns=model_bundle.feature_names)
            
            # Check for missing features
            missing_features = feature_frame.columns[feature_frame.isna().any()].tolist()
            if missing_features:
                raise ValueError(f"Missing or invalid features: {missing_features}")
            
            # Get prediction and probability
            prob = float(model_bundle.model.predict_proba(feature_frame)[:, 1][0])
            pred = int(model_bundle.model.predict(feature_frame)[0])
            
            return {
                'timestamp': record[TIMESTAMP_COLUMN].isoformat(),
                'occupancy': pred,
                'probability': prob,
                'sensor_data': sensor_data,
                'status': 'success',
                'model_version': self._metadata.model_version if self._metadata else 'unknown'
            }
            
        except ValueError as e:
            logger.warning(f"Validation error in prediction: {e}")
            return {
                'timestamp': datetime.now().isoformat(),
                'occupancy': -1,
                'probability': 0.0,
                'sensor_data': sensor_data,
                'status': 'error',
                'error': str(e),
                'error_type': 'validation_error'
            }
        except Exception as e:
            logger.error(f"Unexpected error in prediction: {e}")
            return {
                'timestamp': datetime.now().isoformat(),
                'occupancy': -1,
                'probability': 0.0,
                'sensor_data': sensor_data,
                'status': 'error',
                'error': str(e),
                'error_type': 'prediction_error'
            }
    
    def predict_from_request(self, request_data: Dict[str, Any]) -> tuple[int, float]:
        """
        Make prediction from API request data with validation.
        
        Args:
            request_data: Request data from API
            
        Returns:
            Tuple of (prediction, probability)
            
        Raises:
            ValueError: If input validation fails
        """
        if not self._is_loaded:
            raise RuntimeError("Model not loaded")
        
        model_bundle = self.get_model_bundle()
        
        record = request_data.copy()
        record[TIMESTAMP_COLUMN] = pd.to_datetime(record[TIMESTAMP_COLUMN], errors="coerce")
        
        if pd.isna(record[TIMESTAMP_COLUMN]):
            raise ValueError("Invalid datetime provided for 'date' field")
        
        df = pd.DataFrame([record])
        feature_frame, _ = build_feature_matrix(df, timestamp_col=TIMESTAMP_COLUMN, target_col=None)
        feature_frame = feature_frame.reindex(columns=model_bundle.feature_names)
        
        if feature_frame.isna().any().any():
            raise ValueError("NaN values encountered after feature engineering")
        
        prob = float(model_bundle.model.predict_proba(feature_frame)[:, 1][0])
        pred = int(model_bundle.model.predict(feature_frame)[0])
        
        return pred, prob
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get comprehensive health status of the model manager."""
        status = {
            'model_loaded': self._is_loaded,
            'artifact_dir': str(self.artifact_dir),
            'load_error': self._load_error,
            'metadata': None
        }
        
        if self._metadata:
            status['metadata'] = {
                'model_version': self._metadata.model_version,
                'training_date': self._metadata.training_date.isoformat(),
                'model_type': self._metadata.model_type,
                'feature_count': len(self._metadata.feature_names)
            }
        
        return status


# Global model manager instance
_model_manager = ModelManager()


def get_model_manager() -> ModelManager:
    """Get the global model manager instance."""
    return _model_manager


def initialize_model_manager(artifact_dir: Optional[Path] = None) -> bool:
    """
    Initialize the global model manager.
    
    Args:
        artifact_dir: Optional custom artifact directory
        
    Returns:
        bool: True if initialization successful
    """
    global _model_manager
    _model_manager = ModelManager(artifact_dir)
    return _model_manager.load_model()


@asynccontextmanager
async def model_manager_context(artifact_dir: Optional[Path] = None):
    """Context manager for model manager lifecycle."""
    manager = ModelManager(artifact_dir)
    success = manager.load_model()
    
    if not success:
        raise RuntimeError(f"Failed to load model: {manager.load_error}")
    
    try:
        yield manager
    finally:
        # Cleanup if needed
        pass
