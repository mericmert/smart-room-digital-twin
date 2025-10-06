#!/usr/bin/env python3
"""
Local development server for the occupancy ML API.
This script starts the FastAPI server with proper configuration.
"""

import uvicorn
from src.occupancy_ml.api.api import app
from src.occupancy_ml.config import API_HOST, API_PORT, DEBUG

if __name__ == "__main__":
    print(f"Starting Occupancy ML API server...")
    print(f"Host: {API_HOST}")
    print(f"Port: {API_PORT}")
    print(f"Debug mode: {DEBUG}")
    print(f"API docs will be available at: http://{API_HOST}:{API_PORT}/docs")
    print(f"Health check: http://{API_HOST}:{API_PORT}/health")
    print("\nPress Ctrl+C to stop the server")
    
    uvicorn.run(
        "src.occupancy_ml.api.api:app",
        host=API_HOST,
        port=API_PORT,
        reload=DEBUG,
        log_level="debug" if DEBUG else "info"
    )
