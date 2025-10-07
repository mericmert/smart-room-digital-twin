"""API request/response models."""

from datetime import datetime
from typing import Dict, Any, Optional

from pydantic import BaseModel, Field


class OccupancyRequest(BaseModel):
    """Request model for occupancy prediction."""
    date: datetime = Field(..., description="Timestamp of the observation")
    Temperature: float = Field(..., description="Room temperature in Celsius")
    Humidity: float = Field(..., description="Relative humidity percentage")
    Light: float = Field(..., description="Light level in lux")
    CO2: float = Field(..., description="CO2 concentration in ppm")
    HumidityRatio: float = Field(..., description="Absolute humidity ratio")


class OccupancyResponse(BaseModel):
    """Response model for occupancy prediction."""
    occupancy: int = Field(..., description="Predicted occupancy class (1=occupied, 0=vacant)")
    probability: float = Field(..., ge=0.0, le=1.0, description="Model probability of occupancy")


class EnhancedOccupancyResponse(BaseModel):
    """Enhanced response model with features, anomaly detection, and comprehensive results."""
    features: Dict[str, Any] = Field(..., description="Input features used for prediction")
    prob: float = Field(..., ge=0.0, le=1.0, description="Model probability of occupancy")
    occupancy: int = Field(..., description="Predicted occupancy class (1=occupied, 0=vacant)")
    is_anomaly: bool = Field(..., description="Whether the input data contains anomalies")
    timestamp: str = Field(..., description="Processing timestamp")
    status: str = Field(..., description="Processing status")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    model_version: Optional[str] = Field(None, description="Model version used")
    error: Optional[str] = Field(None, description="Error message if processing failed")
    error_type: Optional[str] = Field(None, description="Type of error if processing failed")


class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str
    kafka_consumer: str
    kafka_topic: str
    kafka_bootstrap_servers: str
