"""Enhanced Kafka consumer functionality for processing sensor data with anomaly detection."""

import json
import logging
import threading
import asyncio
from datetime import datetime
from typing import Callable, Dict, Any, Optional
import pandas as pd

from kafka import KafkaConsumer

from ..config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_GROUP_ID, KAFKA_TOPIC
from ..ml.model_manager import get_model_manager
from ..ml.anomaly_detection import AnomalyDetector
from .websocket_routes import broadcastPredictionResult

logger = logging.getLogger(__name__)


class EnhancedPredictionProcessor:
    """Enhanced prediction processor with anomaly detection and occupancy prediction."""
    
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
    
    def _process_sensor_data(self, sensor_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process sensor data through anomaly detection and occupancy prediction."""
        try:
            # Extract features for processing
            features = {
                'timestamp': sensor_data.get('timestamp', datetime.now().isoformat()),
                'Temperature': sensor_data.get('Temperature', 0),
                'Humidity': sensor_data.get('Humidity', 0),
                'Light': sensor_data.get('Light', 0),
                'CO2': sensor_data.get('CO2', 0),
                'HumidityRatio': sensor_data.get('HumidityRatio', 0)
            }
            
            # Extract actual occupancy if available
            actual_occupancy = sensor_data.get('actualOccupancy', -1)
            
            # Detect anomalies
            is_anomaly = self._detect_anomaly(features)
            
            # Make occupancy prediction
            prediction_result = self.model_manager.predict(features)
            
            # Extract prediction details
            occupancy = prediction_result.get('occupancy', -1)
            probability = prediction_result.get('probability', 0.0)
            
            # Create comprehensive result
            result = {
                'features': features,
                'prob': probability,
                'occupancy': occupancy,
                'actual_occupancy': actual_occupancy,  # Include actual occupancy
                'is_anomaly': is_anomaly,
                'timestamp': datetime.now().isoformat(),
                'status': prediction_result.get('status', 'unknown'),
                'metadata': sensor_data.get('metadata', {}),
                'model_version': prediction_result.get('model_version', 'unknown')
            }
            
            # Add error information if prediction failed
            if prediction_result.get('status') == 'error':
                result['error'] = prediction_result.get('error', 'Unknown error')
                result['error_type'] = prediction_result.get('error_type', 'unknown')
            
            logger.info(f"Processed sensor data - Predicted: {occupancy}, Actual: {actual_occupancy}, Probability: {probability:.3f}, Anomaly: {is_anomaly}")
            return result
            
        except Exception as e:
            logger.error(f"Error processing sensor data: {e}")
            return {
                'features': sensor_data,
                'prob': 0.0,
                'occupancy': -1,
                'actual_occupancy': sensor_data.get('actualOccupancy', -1),
                'is_anomaly': False,
                'timestamp': datetime.now().isoformat(),
                'status': 'error',
                'error': str(e),
                'error_type': 'processing_error',
                'metadata': sensor_data.get('metadata', {})
            }


async def predictionProcessor() -> None:
    """Enhanced prediction processor that processes sensor data with anomaly detection."""
    try:
        consumer = KafkaConsumer(
            KAFKA_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=KAFKA_GROUP_ID,
            auto_offset_reset='earliest',
            value_deserializer=lambda x: x.decode('utf-8') if x else None
        )
        
        # Initialize enhanced consumer
        enhanced_consumer = EnhancedPredictionProcessor()
        
        logger.info(f"Enhanced Kafka consumer started, listening to topic: {KAFKA_TOPIC}")
        
        for message in consumer:
            try:
                logger.info(f"Received Kafka message: {message.value}")
                
                # Parse the sensor data from Kafka message
                sensor_data = json.loads(message.value)
                
                # Process through enhanced pipeline
                result = enhanced_consumer._process_sensor_data(sensor_data)
                
                logger.info(f"Processed result: {result}")
                
                # Broadcast result to WebSocket clients
                try:
                    await broadcastPredictionResult(result)
                    logger.info("Result broadcasted to WebSocket clients")
                except Exception as e:
                    logger.error(f"Failed to broadcast result: {e}")
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from Kafka message: {e}")
            except Exception as e:
                logger.error(f"Error processing Kafka message: {e}")
            
    except Exception as e:
        logger.error(f"Error in enhanced prediction processor: {e}")


def legacyPredictionConsumer(prediction_callback: Callable[[dict], dict]) -> None:
    """Legacy Kafka consumer that processes sensor data through ML model."""
    try:
        consumer = KafkaConsumer(
            KAFKA_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id=KAFKA_GROUP_ID,
            auto_offset_reset='earliest',
            value_deserializer=lambda x: x.decode('utf-8') if x else None
        )
        
        logger.info(f"Kafka consumer started, listening to topic: {KAFKA_TOPIC}")
        
        for message in consumer:
            try:
                logger.info(f"Received Kafka message: {message.value}")
                
                # Parse the sensor data from Kafka message
                sensor_data = json.loads(message.value)
                
                # Process through ML model using callback
                prediction_result = prediction_callback(sensor_data)
                
                logger.info(f"Processed prediction: {prediction_result}")
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from Kafka message: {e}")
            except Exception as e:
                logger.error(f"Error processing Kafka message: {e}")
            
    except Exception as e:
        logger.error(f"Error in legacy prediction consumer: {e}")


def startLegacyPredictionConsumer(prediction_callback: Callable[[dict], dict]) -> None:
    """Start legacy prediction consumer in a separate thread."""
    consumer_thread = threading.Thread(
        target=legacyPredictionConsumer, 
        args=(prediction_callback,), 
        daemon=True
    )
    consumer_thread.start()
    logger.info("Prediction consumer thread started")


def startPredictionProcessor() -> None:
    """Start enhanced prediction processor in a separate thread."""
    def run_async_consumer():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(predictionProcessor())
    
    consumer_thread = threading.Thread(
        target=run_async_consumer, 
        daemon=True
    )
    consumer_thread.start()
    logger.info("Enhanced prediction processor thread started")
