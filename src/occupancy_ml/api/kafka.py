"""Kafka consumer functionality for processing sensor data."""

import json
import logging
import threading
from typing import Callable

from kafka import KafkaConsumer

from ..config import KAFKA_BOOTSTRAP_SERVERS, KAFKA_GROUP_ID, KAFKA_TOPIC
from .websocket import manager

logger = logging.getLogger(__name__)


def kafka_consumer(prediction_callback: Callable[[dict], dict]) -> None:
    """Kafka consumer that processes sensor data through ML model and sends results to web clients."""
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
                
                # Queue message for WebSocket broadcasting (thread-safe)
                manager.queue_message(json.dumps(prediction_result))
                
                logger.info(f"Processed prediction: {prediction_result}")
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from Kafka message: {e}")
            except Exception as e:
                logger.error(f"Error processing Kafka message: {e}")
            
    except Exception as e:
        logger.error(f"Error in Kafka consumer: {e}")


def start_kafka_consumer(prediction_callback: Callable[[dict], dict]) -> None:
    """Start Kafka consumer in a separate thread."""
    consumer_thread = threading.Thread(
        target=kafka_consumer, 
        args=(prediction_callback,), 
        daemon=True
    )
    consumer_thread.start()
    logger.info("Kafka consumer thread started")
