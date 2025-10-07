# Kafka-Based Feature Delivery Implementation

## Overview

I've implemented a proper Kafka-based feature delivery system where:

1. **Features are delivered via Apache Kafka** (not HTTP requests)
2. **Kafka consumer processes** features through anomaly detection and ML prediction
3. **Results are sent back** to web clients via WebSocket
4. **Real-time processing** with comprehensive result format

## Architecture Flow

```
Replay System → Kafka → Enhanced Consumer → Anomaly Detection → ML Prediction → WebSocket → Web Client
```

## Key Components Implemented

### 1. **WebSocket Routes** (`src/occupancy_ml/api/websocket_routes.py`)

- **Real-time result delivery** to connected web clients
- **Connection management** with automatic cleanup
- **Recent results caching** for new connections
- **Broadcast mechanism** for Kafka-processed results

**Key Features:**
- WebSocket endpoint: `/ws/kafka-results`
- Status endpoint: `/ws/status`
- Automatic connection management
- Result broadcasting to all connected clients

### 2. **Enhanced Kafka Consumer** (`src/occupancy_ml/api/kafka.py`)

- **Async Kafka consumer** with WebSocket integration
- **Domain-based anomaly detection** (no training data required)
- **Comprehensive result processing**
- **Real-time result broadcasting**

**Processing Pipeline:**
1. Receive sensor data from Kafka
2. Extract features for processing
3. Detect anomalies using domain thresholds
4. Run occupancy prediction ML model
5. Broadcast results via WebSocket

### 3. **Kafka WebSocket Client** (`digital-twin-client/src/components/KafkaWebSocketClient.tsx`)

- **Real-time WebSocket connection** to ML API
- **Automatic reconnection** with exponential backoff
- **Result display** with anomaly indicators
- **Connection status monitoring**

**Features:**
- Real-time connection status
- Latest result display
- Anomaly detection indicators
- Manual connection controls
- Keep-alive ping mechanism

### 4. **Updated Dashboard** (`digital-twin-client/src/components/Dashboard.tsx`)

- **Integrated Kafka WebSocket client**
- **Real-time result updates**
- **Seamless integration** with existing components

## Data Flow

### 1. **Feature Delivery via Kafka**

**Replay System sends to Kafka:**
```json
{
  "timestamp": "2024-01-01T12:00:00Z",
  "Temperature": 23.5,
  "Humidity": 45.2,
  "Light": 500,
  "CO2": 600,
  "HumidityRatio": 0.008,
  "metadata": {
    "source": "replay",
    "filename": "datatest.txt",
    "timestamp": "2024-01-01T12:00:00Z"
  },
  "processed_at": "2024-01-01T12:00:01Z"
}
```

### 2. **Kafka Consumer Processing**

**Enhanced consumer processes:**
1. **Anomaly Detection**: Domain-based thresholds
2. **ML Prediction**: Occupancy prediction model
3. **Result Formatting**: Comprehensive result object

### 3. **WebSocket Result Delivery**

**Results sent to web clients:**
```json
{
  "type": "kafka_result",
  "data": {
    "features": {
      "timestamp": "2024-01-01T12:00:00Z",
      "Temperature": 23.5,
      "Humidity": 45.2,
      "Light": 500,
      "CO2": 600,
      "HumidityRatio": 0.008
    },
    "prob": 0.85,
    "occupancy": 1,
    "is_anomaly": false,
    "timestamp": "2024-01-01T12:00:01Z",
    "status": "success",
    "model_version": "v2.0",
    "metadata": {
      "source": "replay",
      "filename": "datatest.txt"
    }
  },
  "timestamp": "2024-01-01T12:00:01Z"
}
```

## Anomaly Detection

**Domain-based thresholds** (no training data required):
- **Temperature**: 10-40°C
- **Humidity**: 0-100%
- **Light**: 0-2000 lux
- **CO2**: 300-2000 ppm
- **HumidityRatio**: 0-0.02

Values outside these ranges are flagged as anomalies.

## Usage Instructions

### 1. **Start the System**

```bash
# Start ML API with Kafka enabled
ENABLE_KAFKA=true python -m src.occupancy_ml.api.api

# Start Next.js client
cd digital-twin-client && npm run dev
```

### 2. **Send Data via Kafka**

Use the replay system to send historical data:
```javascript
// Send data to Kafka for processing
POST /api/replay
{
  "action": "send-kafka-message",
  "filename": "datatest.txt",
  "time": "2024-01-01T12:00:00Z"
}
```

### 3. **Receive Results**

The web client automatically connects to WebSocket and receives:
- Real-time processing results
- Anomaly detection status
- Comprehensive prediction data
- Connection status updates

## Benefits

1. **True Kafka Integration**: Features delivered via Kafka, not HTTP
2. **Real-time Processing**: Immediate result delivery via WebSocket
3. **Scalable Architecture**: Kafka-based processing supports high throughput
4. **Anomaly Detection**: Built-in anomaly detection without training data
5. **Comprehensive Results**: Rich result format with all required fields
6. **Visual Feedback**: Real-time UI updates with anomaly indicators
7. **Robust Connection**: Automatic reconnection and error handling

## Configuration

### Environment Variables
```bash
# Kafka Configuration
ENABLE_KAFKA=true
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_TOPIC=test-topic
KAFKA_GROUP_ID=occupancy-ml-consumer

# ML API Configuration
ML_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_ML_API_URL=ws://localhost:8000
```

## Testing

The system can be tested by:
1. Starting the ML API with Kafka enabled
2. Starting the Next.js client
3. Using the replay system to send data
4. Observing real-time results in the web interface

## Future Enhancements

- **Database Storage**: Persistent storage of prediction results
- **Multiple Topics**: Support for different data sources
- **Advanced Anomaly Detection**: ML-based anomaly detection with training data
- **Metrics Dashboard**: Real-time system performance monitoring
- **Alert System**: Notifications for anomalies and system issues
