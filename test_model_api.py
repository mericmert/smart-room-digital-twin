"""Comprehensive test suite for model manager and API."""

import json
import pytest
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch
from datetime import datetime

import pandas as pd
import joblib
from sklearn.linear_model import LogisticRegression

from src.occupancy_ml.ml.model_manager import ModelManager, ModelMetadata
from src.occupancy_ml.ml.prediction import process_sensor_data, predict_occupancy
from src.occupancy_ml.api.routes import predict, health, health_detailed
from src.occupancy_ml.api.models import OccupancyRequest


@pytest.fixture
def temp_artifact_dir():
    """Create temporary artifact directory with mock model."""
    with tempfile.TemporaryDirectory() as temp_dir:
        artifact_path = Path(temp_dir)
        
        # Create mock model
        model = LogisticRegression(random_state=42)
        X_train = pd.DataFrame({
            'date': pd.date_range('2023-01-01', periods=100, freq='H'),
            'Temperature': [20.0] * 100,
            'Humidity': [50.0] * 100,
            'Light': [300.0] * 100,
            'CO2': [400.0] * 100,
            'HumidityRatio': [0.01] * 100
        })
        
        # Add time features
        X_train['hour'] = X_train['date'].dt.hour
        X_train['dayofweek'] = X_train['date'].dt.dayofweek
        X_train['is_weekend'] = (X_train['date'].dt.dayofweek >= 5).astype(int)
        X_train['hour_sin'] = pd.Series([0.0] * 100)
        X_train['hour_cos'] = pd.Series([1.0] * 100)
        X_train['dow_sin'] = pd.Series([0.0] * 100)
        X_train['dow_cos'] = pd.Series([1.0] * 100)
        
        feature_names = ['Temperature', 'Humidity', 'Light', 'CO2', 'HumidityRatio', 
                        'hour', 'dayofweek', 'is_weekend', 'hour_sin', 'hour_cos', 
                        'dow_sin', 'dow_cos']
        
        X_features = X_train[feature_names]
        y_train = [0, 1] * 50  # Mock target
        
        model.fit(X_features, y_train)
        
        # Save model artifacts
        joblib.dump(model, artifact_path / "model.joblib")
        
        with open(artifact_path / "feature_names.json", 'w') as f:
            json.dump(feature_names, f)
        
        metadata = {
            "model_version": "test_v1.0",
            "training_date": datetime.now().isoformat(),
            "feature_names": feature_names,
            "model_type": "LogisticRegression",
            "performance_metrics": {"accuracy": 0.95}
        }
        
        with open(artifact_path / "metadata.json", 'w') as f:
            json.dump(metadata, f)
        
        yield artifact_path


@pytest.fixture
def model_manager(temp_artifact_dir):
    """Create ModelManager instance with test artifacts."""
    manager = ModelManager(temp_artifact_dir)
    manager.load_model()
    return manager


class TestModelManager:
    """Test cases for ModelManager class."""
    
    def test_model_loading_success(self, temp_artifact_dir):
        """Test successful model loading."""
        manager = ModelManager(temp_artifact_dir)
        assert manager.load_model() is True
        assert manager.is_loaded is True
        assert manager.load_error is None
        assert manager.metadata is not None
        assert manager.metadata.model_version == "test_v1.0"
    
    def test_model_loading_failure(self):
        """Test model loading failure with invalid directory."""
        manager = ModelManager(Path("/nonexistent/path"))
        assert manager.load_model() is False
        assert manager.is_loaded is False
        assert manager.load_error is not None
    
    def test_model_prediction_success(self, model_manager):
        """Test successful model prediction."""
        sensor_data = {
            'timestamp': datetime.now().isoformat(),
            'Temperature': 22.0,
            'Humidity': 45.0,
            'Light': 250.0,
            'CO2': 450.0,
            'HumidityRatio': 0.012
        }
        
        result = model_manager.predict(sensor_data)
        
        assert result['status'] == 'success'
        assert 'occupancy' in result
        assert 'probability' in result
        assert 'timestamp' in result
        assert result['occupancy'] in [0, 1]
        assert 0.0 <= result['probability'] <= 1.0
    
    def test_model_prediction_validation_error(self, model_manager):
        """Test prediction with invalid input data."""
        sensor_data = {
            'timestamp': 'invalid-date',
            'Temperature': 'not-a-number',
            'Humidity': 45.0,
            'Light': 250.0,
            'CO2': 450.0,
            'HumidityRatio': 0.012
        }
        
        result = model_manager.predict(sensor_data)
        
        assert result['status'] == 'error'
        assert result['error_type'] == 'validation_error'
        assert result['occupancy'] == -1
        assert result['probability'] == 0.0
    
    def test_model_not_loaded_error(self):
        """Test prediction when model is not loaded."""
        manager = ModelManager(Path("/nonexistent/path"))
        sensor_data = {'Temperature': 22.0}
        
        result = manager.predict(sensor_data)
        
        assert result['status'] == 'error'
        assert result['error_type'] == 'model_not_loaded'
        assert result['occupancy'] == -1
    
    def test_health_status(self, model_manager):
        """Test health status reporting."""
        status = model_manager.get_health_status()
        
        assert status['model_loaded'] is True
        assert status['artifact_dir'] is not None
        assert status['load_error'] is None
        assert status['metadata'] is not None
        assert status['metadata']['model_version'] == "test_v1.0"


class TestPredictionFunctions:
    """Test cases for prediction functions."""
    
    def test_process_sensor_data_success(self, model_manager):
        """Test process_sensor_data function."""
        with patch('src.occupancy_ml.ml.prediction.get_model_manager', return_value=model_manager):
            sensor_data = {
                'timestamp': datetime.now().isoformat(),
                'Temperature': 22.0,
                'Humidity': 45.0,
                'Light': 250.0,
                'CO2': 450.0,
                'HumidityRatio': 0.012
            }
            
            result = process_sensor_data(sensor_data)
            
            assert result['status'] == 'success'
            assert 'occupancy' in result
            assert 'probability' in result
    
    def test_predict_occupancy_success(self, model_manager):
        """Test predict_occupancy function."""
        with patch('src.occupancy_ml.ml.prediction.get_model_manager', return_value=model_manager):
            request_data = {
                'date': datetime.now(),
                'Temperature': 22.0,
                'Humidity': 45.0,
                'Light': 250.0,
                'CO2': 450.0,
                'HumidityRatio': 0.012
            }
            
            pred, prob = predict_occupancy(request_data)
            
            assert pred in [0, 1]
            assert 0.0 <= prob <= 1.0
    
    def test_predict_occupancy_validation_error(self, model_manager):
        """Test predict_occupancy with invalid data."""
        with patch('src.occupancy_ml.ml.prediction.get_model_manager', return_value=model_manager):
            request_data = {
                'date': 'invalid-date',
                'Temperature': 22.0,
                'Humidity': 45.0,
                'Light': 250.0,
                'CO2': 450.0,
                'HumidityRatio': 0.012
            }
            
            with pytest.raises(ValueError):
                predict_occupancy(request_data)


class TestAPIRoutes:
    """Test cases for API routes."""
    
    def test_health_endpoint(self, model_manager):
        """Test health endpoint."""
        with patch('src.occupancy_ml.api.routes.get_model_manager', return_value=model_manager):
            response = health()
            
            assert response.status == "ok"
            assert response.kafka_consumer == "running"
            assert response.kafka_topic is not None
    
    def test_health_detailed_endpoint(self, model_manager):
        """Test detailed health endpoint."""
        with patch('src.occupancy_ml.api.routes.get_model_manager', return_value=model_manager):
            response = health_detailed()
            
            assert response['api_status'] == "ok"
            assert 'model' in response
            assert 'kafka' in response
            assert response['model']['model_loaded'] is True
    
    def test_predict_endpoint_success(self, model_manager):
        """Test successful prediction endpoint."""
        with patch('src.occupancy_ml.api.routes.predict_occupancy') as mock_predict:
            mock_predict.return_value = (1, 0.85)
            
            request = OccupancyRequest(
                date=datetime.now(),
                Temperature=22.0,
                Humidity=45.0,
                Light=250.0,
                CO2=450.0,
                HumidityRatio=0.012
            )
            
            response = predict(request)
            
            assert response.occupancy == 1
            assert response.probability == 0.85
    
    def test_predict_endpoint_validation_error(self, model_manager):
        """Test prediction endpoint with validation error."""
        with patch('src.occupancy_ml.api.routes.predict_occupancy') as mock_predict:
            mock_predict.side_effect = ValueError("Invalid input data")
            
            request = OccupancyRequest(
                date=datetime.now(),
                Temperature=22.0,
                Humidity=45.0,
                Light=250.0,
                CO2=450.0,
                HumidityRatio=0.012
            )
            
            with pytest.raises(Exception):  # HTTPException
                predict(request)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
