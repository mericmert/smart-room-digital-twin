# Digital Twin Project - Occupancy Prediction System

A comprehensive digital twin system for real-time occupancy prediction using machine learning, featuring a Python ML backend with FastAPI, a Next.js frontend with 3D visualization, and Apache Kafka for real-time data streaming.

## 🏗️ System Architecture

This project implements a complete digital twin solution with the following components:

- **ML Backend**: Python-based occupancy prediction API with anomaly detection
- **Frontend**: Next.js application with 3D office room visualization
- **Data Streaming**: Apache Kafka for real-time sensor data processing
- **Deployment**: Docker-based containerization with development and production profiles

## 📊 Features

### Machine Learning Backend
- **Temporal Cross-Validation**: Time-series aware model training
- **Anomaly Detection**: Multiple detection methods (statistical, ML-based, domain-specific)
- **Real-time Prediction**: FastAPI-based REST API with WebSocket support
- **Model Management**: Versioned model artifacts with automatic loading
- **Performance Monitoring**: Metrics collection and health checks

### Frontend Visualization
- **3D Office Room**: Interactive Three.js-based 3D visualization
- **Real-time Charts**: Live sensor data visualization with Recharts
- **Time Scrubber**: Historical data playback controls
- **Sensor Metrics**: Real-time display of environmental parameters
- **Kafka Integration**: WebSocket-based real-time data streaming

### Data Processing
- **Sensor Data**: Temperature, Humidity, Light, CO2, Humidity Ratio
- **Occupancy Prediction**: Binary classification with probability scores
- **Anomaly Detection**: Automatic detection and handling of sensor anomalies
- **Data Validation**: Comprehensive input validation and error handling

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Python 3.9+ (for local development)
- Node.js 18+ (for local development)
- Git

### Development Mode (Recommended for Development)

Start the development environment where Kafka runs in Docker but ML API and Next.js run locally:

```bash
# Start development environment
./dev-mode.sh start

# Check status
./dev-mode.sh status

# View logs
./dev-mode.sh logs

# Stop environment
./dev-mode.sh stop
```

This will start:
- **Kafka**: `http://localhost:9092` (Docker)
- **ML API**: `http://localhost:8000` (Local)
- **Next.js**: `http://localhost:3000` (Local)
- **API Docs**: `http://localhost:8000/docs`

### Production Mode (Full Docker Deployment)

For production deployment with all services containerized:

```bash
# Start production environment
./prod-mode.sh start

# Check status
./prod-mode.sh status

# View logs
./prod-mode.sh logs

# Stop environment
./prod-mode.sh stop
```

## 📁 Project Structure

```
digital_twin_project/
├── src/occupancy_ml/           # Python ML backend
│   ├── api/                    # FastAPI application
│   │   ├── api.py             # Main FastAPI app
│   │   ├── routes.py          # REST API endpoints
│   │   ├── websocket_routes.py # WebSocket endpoints
│   │   ├── kafka.py           # Kafka integration
│   │   └── models.py          # Pydantic models
│   ├── ml/                    # Machine learning modules
│   │   ├── modeling.py        # ML pipeline definition
│   │   ├── anomaly_detection.py # Anomaly detection
│   │   ├── prediction.py      # Real-time prediction
│   │   ├── model_manager.py   # Model loading/management
│   │   └── train.py           # Training pipeline
│   ├── config.py              # Configuration management
│   └── cli.py                 # Command-line interface
├── digital-twin-client/        # Next.js frontend
│   ├── src/
│   │   ├── app/               # Next.js app router
│   │   ├── components/        # React components
│   │   │   ├── Dashboard.tsx  # Main dashboard
│   │   │   ├── OfficeRoom3D.tsx # 3D visualization
│   │   │   ├── LiveSensorCharts.tsx # Real-time charts
│   │   │   └── KafkaWebSocketClient.tsx # Kafka integration
│   │   ├── hooks/             # Custom React hooks
│   │   └── utils/             # Utility functions
│   └── package.json
├── artifacts/                  # Trained ML models
│   ├── occ_v1/               # Model version 1
│   ├── occ_v2/               # Model version 2
│   ├── occ_v3/               # Model version 3
│   └── occ_v4/               # Model version 4
├── data/                     # Training and test datasets
├── evaluation_results/       # Model evaluation metrics
├── docker-compose.yaml       # Docker services configuration
├── Dockerfile                # Multi-stage Docker build
├── pyproject.toml           # Python package configuration
└── README.md                # This file
```

## 🔧 Configuration

### Environment Variables

The system uses environment variables for configuration. Key variables include:

#### ML API Configuration
```bash
# Model Configuration
OCC_MODEL_DIR=/app/artifacts/occ_v2
MODEL_VALIDATION_ENABLED=true
MODEL_RELOAD_ON_ERROR=false

# Kafka Configuration
KAFKA_BOOTSTRAP_SERVERS=broker:9092
KAFKA_TOPIC=prod-occupancy-sensor-data
KAFKA_GROUP_ID=prod-occupancy-ml-consumer
ENABLE_KAFKA=true

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO

# Performance Configuration
MAX_PREDICTION_BATCH_SIZE=150
PREDICTION_TIMEOUT_SECONDS=20
```

#### Frontend Configuration
```bash
# ML API Configuration
NEXT_PUBLIC_ML_API_URL=http://localhost:8000
NEXT_PUBLIC_ML_API_WS_URL=ws://localhost:8000/ws

# Kafka Configuration
NEXT_PUBLIC_KAFKA_TOPIC=prod-occupancy-sensor-data
ENABLE_KAFKA=true
```

### Docker Profiles

The system supports multiple deployment profiles:

- **`local-dev`**: Kafka only (for local development)
- **`development`**: Full development stack in Docker
- **`production`**: Full production stack in Docker
- **`testing`**: Kafka + test utilities
- **`full`**: All services

## 🤖 Machine Learning Pipeline

### Model Training

Train models with temporal cross-validation:

```bash
# Install the package
pip install -e .

# Train with temporal CV
occ-ml-train \
  --data data/datatraining.txt \
  --artifact-dir artifacts/occ_v1 \
  --n-splits 5 \
  --gap 5
```

### Model Evaluation

Evaluate trained models on holdout data:

```bash
# Evaluate model performance
occ-ml-eval \
  --data data/datatest.txt \
  --artifacts artifacts/occ_v1 \
  --out evaluation/
```

### Anomaly Detection

The system includes comprehensive anomaly detection:

- **Statistical Methods**: Z-score and IQR-based detection
- **Machine Learning**: Isolation Forest for complex patterns
- **Domain-Specific**: Threshold-based detection for sensor ranges
- **Combined Approach**: Multi-method ensemble detection

## 🌐 API Endpoints

### REST API

- `GET /health` - Health check
- `POST /predict` - Single prediction
- `POST /predict/batch` - Batch predictions
- `GET /models/info` - Model information
- `GET /metrics` - System metrics

### WebSocket API

- `ws://localhost:8000/ws` - Real-time prediction stream
- `ws://localhost:8000/ws/kafka` - Kafka data stream

### Data API

- `GET /data/files` - List available data files
- `GET /data/{filename}` - Get data file content
- `POST /replay` - Start data replay

## 🎨 Frontend Components

### Dashboard
Main application interface with:
- Time scrubber controls for historical data
- 3D office room visualization
- Real-time sensor metrics
- Live data charts

### 3D Visualization
Interactive Three.js-based office room showing:
- **Environmental Conditions**: Wall colors based on temperature/humidity
- **Occupancy**: 3D people models representing current occupancy
- **Air Quality**: CO2 indicators with color coding
- **Lighting**: Dynamic lighting based on sensor readings
- **Humidity**: Particle effects and floating indicators

### Real-time Charts
Live sensor data visualization with:
- Temperature, Humidity, Light, CO2 trends
- Actual vs Predicted occupancy comparison
- Configurable time windows
- WebSocket-based real-time updates

## 📊 Data Format

### Input Data Format
```json
{
  "timestamp": "2024-01-01T10:00:00Z",
  "Temperature": 22.5,
  "Humidity": 45.2,
  "Light": 350.0,
  "CO2": 450.0,
  "HumidityRatio": 0.0085,
  "Occupancy": 1
}
```

### Prediction Response
```json
{
  "features": {
    "timestamp": "2024-01-01T10:00:00Z",
    "Temperature": 22.5,
    "Humidity": 45.2,
    "Light": 350.0,
    "CO2": 450.0,
    "HumidityRatio": 0.0085
  },
  "prob": 0.85,
  "occupancy": 1,
  "is_anomaly": false,
  "timestamp": "2024-01-01T10:00:00Z",
  "status": "success",
  "model_version": "occ_v2"
}
```

## 🔍 Monitoring and Observability

### Health Checks
- API health endpoint: `GET /health`
- Docker health checks for all services
- Kafka connectivity monitoring

### Development Deployment
```bash
# Start development environment
./dev-mode.sh start

# Access services
# - Frontend: http://localhost:3000
# - API: http://localhost:8000
# - API Docs: http://localhost:8000/docs
```

### Production Deployment
```bash
# Start production environment
./prod-mode.sh start

# Scale services if needed
./prod-mode.sh scale occupancy-api 3
./prod-mode.sh scale digital-twin-client 2
```

### Docker Compose Profiles
```bash
# Local development (Kafka only)
docker-compose --profile local-dev up

# Full development stack
docker-compose --profile development up

# Production stack
docker-compose --profile production up

# All services
docker-compose --profile full up
```