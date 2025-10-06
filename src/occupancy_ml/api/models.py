"""API request/response models."""

from datetime import datetime

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


class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str
    kafka_consumer: str
    kafka_topic: str
    kafka_bootstrap_servers: str
