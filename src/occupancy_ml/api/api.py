"""Main FastAPI application for occupancy prediction."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..config import LOG_LEVEL
from .kafka import startLegacyPredictionConsumer, startPredictionProcessor
from ..ml.prediction import process_sensor_data
from ..ml.model_manager import initialize_model_manager
from .routes import router
from .data_routes import router as data_router
from .websocket_routes import router as websocket_router

logging.basicConfig(level=getattr(logging, LOG_LEVEL.upper()))
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events with proper model initialization."""
    logger.info("Starting occupancy prediction API...")
    logger.info(f"Environment: DEBUG={os.environ.get('DEBUG', 'not set')}")
    logger.info(f"Environment: LOG_LEVEL={os.environ.get('LOG_LEVEL', 'not set')}")
    logger.info(f"Environment: ENABLE_KAFKA={os.environ.get('ENABLE_KAFKA', 'not set')}")
    
    # Initialize model manager
    try:
        model_loaded = initialize_model_manager()
        if not model_loaded:
            logger.error("Failed to load model during startup")
            raise RuntimeError("Model initialization failed")
        
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Error during model initialization: {e}")
        raise RuntimeError(f"Model initialization failed: {e}")
    
    # Only start Kafka consumer if explicitly enabled
    kafka_bootstrap_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    enable_kafka = os.environ.get("ENABLE_KAFKA", "false").lower() == "true"
    
    logger.info(f"Kafka configuration: bootstrap_servers={kafka_bootstrap_servers}, enabled={enable_kafka}")
    
    if enable_kafka:
        try:
            # Start enhanced prediction processor with anomaly detection
            startPredictionProcessor()
            logger.info(f"Enhanced prediction processor started for topic: {os.environ.get('KAFKA_TOPIC', 'test-topic')}")
        except Exception as e:
            logger.error(f"Failed to start enhanced prediction processor: {e}")
            # Fallback to legacy consumer
            try:
                startLegacyPredictionConsumer(process_sensor_data)
                logger.info(f"Legacy prediction consumer started for topic: {os.environ.get('KAFKA_TOPIC', 'test-topic')}")
            except Exception as fallback_e:
                logger.error(f"Failed to start legacy prediction consumer: {fallback_e}")
                # Don't fail startup if Kafka is not available
    else:
        logger.info("Prediction processor disabled - set ENABLE_KAFKA=true to enable")
    
    logger.info("API startup complete")
    yield
    
    # Cleanup
    logger.info("API shutdown complete")


app = FastAPI(
    title="Occupancy Predictor", 
    version="0.1.0", 
    lifespan=lifespan,
    description="ML-powered occupancy prediction API with Kafka integration"
)

enable_cors = os.environ.get("ENABLE_CORS", "true").lower() == "true"

if enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(router)
app.include_router(data_router)
app.include_router(websocket_router)