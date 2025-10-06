"""Configuration settings for the occupancy ML API."""

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

# Model artifacts configuration
_env_dir = os.environ.get("OCC_MODEL_DIR")
if _env_dir:
    DEFAULT_ARTIFACT_DIR = Path(_env_dir).expanduser()
else:
    DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "occ_v1"

# Kafka configuration
KAFKA_BOOTSTRAP_SERVERS = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TOPIC = os.environ.get("KAFKA_TOPIC", "test-topic")
KAFKA_GROUP_ID = os.environ.get("KAFKA_GROUP_ID", "occupancy-ml-consumer")

# Data processing configuration
TIMESTAMP_COLUMN = "date"

# Logging configuration
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

# API configuration
API_HOST = os.environ.get("API_HOST", "0.0.0.0")
API_PORT = int(os.environ.get("API_PORT", "8000"))

# Model configuration
MODEL_VALIDATION_ENABLED = os.environ.get("MODEL_VALIDATION_ENABLED", "true").lower() == "true"
MODEL_RELOAD_ON_ERROR = os.environ.get("MODEL_RELOAD_ON_ERROR", "false").lower() == "true"

# Performance configuration
MAX_PREDICTION_BATCH_SIZE = int(os.environ.get("MAX_PREDICTION_BATCH_SIZE", "100"))
PREDICTION_TIMEOUT_SECONDS = int(os.environ.get("PREDICTION_TIMEOUT_SECONDS", "30"))

# Development configuration
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
ENABLE_CORS = os.environ.get("ENABLE_CORS", "false").lower() == "true"

# Monitoring configuration
ENABLE_METRICS = os.environ.get("ENABLE_METRICS", "false").lower() == "true"
METRICS_PORT = int(os.environ.get("METRICS_PORT", "9090"))

# Security configuration
API_KEY = os.environ.get("API_KEY", "")
ENABLE_RATE_LIMITING = os.environ.get("ENABLE_RATE_LIMITING", "false").lower() == "true"
RATE_LIMIT_PER_MINUTE = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "1000"))


def get_model_config() -> dict:
    """Get model configuration dictionary."""
    return {
        "artifact_dir": str(DEFAULT_ARTIFACT_DIR),
        "validation_enabled": MODEL_VALIDATION_ENABLED,
        "reload_on_error": MODEL_RELOAD_ON_ERROR,
        "timestamp_column": TIMESTAMP_COLUMN
    }


def get_kafka_config() -> dict:
    """Get Kafka configuration dictionary."""
    return {
        "bootstrap_servers": KAFKA_BOOTSTRAP_SERVERS,
        "topic": KAFKA_TOPIC,
        "group_id": KAFKA_GROUP_ID
    }


def get_api_config() -> dict:
    """Get API configuration dictionary."""
    return {
        "host": API_HOST,
        "port": API_PORT,
        "log_level": LOG_LEVEL,
        "max_batch_size": MAX_PREDICTION_BATCH_SIZE,
        "timeout_seconds": PREDICTION_TIMEOUT_SECONDS,
        "debug": DEBUG,
        "enable_cors": ENABLE_CORS
    }


def get_monitoring_config() -> dict:
    """Get monitoring configuration dictionary."""
    return {
        "enable_metrics": ENABLE_METRICS,
        "metrics_port": METRICS_PORT
    }


def get_security_config() -> dict:
    """Get security configuration dictionary."""
    return {
        "api_key": API_KEY,
        "enable_rate_limiting": ENABLE_RATE_LIMITING,
        "rate_limit_per_minute": RATE_LIMIT_PER_MINUTE
    }


def get_all_config() -> dict:
    """Get all configuration as a dictionary."""
    return {
        "model": get_model_config(),
        "kafka": get_kafka_config(),
        "api": get_api_config(),
        "monitoring": get_monitoring_config(),
        "security": get_security_config()
    }


def validate_config() -> list[str]:
    """Validate configuration and return list of issues."""
    issues = []
    
    # Check if model directory exists
    if not DEFAULT_ARTIFACT_DIR.exists():
        issues.append(f"Model directory does not exist: {DEFAULT_ARTIFACT_DIR}")
    
    # Check API port range
    if not (1 <= API_PORT <= 65535):
        issues.append(f"Invalid API port: {API_PORT}")
    
    # Check metrics port range
    if not (1 <= METRICS_PORT <= 65535):
        issues.append(f"Invalid metrics port: {METRICS_PORT}")
    
    # Check batch size
    if MAX_PREDICTION_BATCH_SIZE <= 0:
        issues.append(f"Invalid batch size: {MAX_PREDICTION_BATCH_SIZE}")
    
    # Check timeout
    if PREDICTION_TIMEOUT_SECONDS <= 0:
        issues.append(f"Invalid timeout: {PREDICTION_TIMEOUT_SECONDS}")
    
    return issues
