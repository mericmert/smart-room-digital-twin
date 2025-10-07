# Enhanced Replay and Predict System with Kafka and Anomaly Detection

## Overview

The replay and predict mechanism has been enhanced to:

1. **Deliver features via Apache Kafka** - Sensor data is sent through Kafka for processing
2. **Process features for anomaly detection** - Data is analyzed for anomalies before ML prediction
3. **Process occupancy prediction ML model** - Enhanced prediction with anomaly detection
4. **Return comprehensive results** - Response includes `{features, prob, occupancy, is_anomaly}`

## Key Changes Made

### 1. Enhanced Kafka Consumer (`src/occupancy_ml/api/kafka.py`)

- **New `EnhancedKafkaConsumer` class** with integrated anomaly detection
- **Anomaly detection** using statistical methods, domain thresholds, and Isolation Forest
- **Comprehensive processing pipeline** that combines anomaly detection with occupancy prediction
- **Enhanced result format** including features, probability, occupancy, and anomaly status

### 2. Enhanced Prediction API (`src/occupancy_ml/ml/prediction.py`)

- **New `EnhancedPredictionProcessor` class** for integrated processing
- **Anomaly detection integration** before occupancy prediction
- **Comprehensive result format** with all required fields
- **Backward compatibility** with existing prediction functions

### 3. Updated API Models (`src/occupancy_ml/api/models.py`)

- **New `EnhancedOccupancyResponse` model** with comprehensive fields:
  - `features`: Input features used for prediction
  - `prob`: Model probability of occupancy
  - `occupancy`: Predicted occupancy class
  - `is_anomaly`: Whether input data contains anomalies
  - `timestamp`: Processing timestamp
  - `status`: Processing status
  - `metadata`: Additional metadata
  - `model_version`: Model version used
  - `error`: Error message if processing failed
  - `error_type`: Type of error if processing failed

### 4. Enhanced API Routes (`src/occupancy_ml/api/routes.py`)

- **New `/predict-enhanced` endpoint** with anomaly detection
- **New `/kafka-result` endpoint** for receiving processed results from Kafka
- **Comprehensive error handling** with detailed error types
- **Backward compatibility** with existing `/predict` endpoint

### 5. Updated Replay API (`digital-twin-client/src/app/api/replay/route.ts`)

- **Enhanced Kafka message sending** with actual sensor data from replay files
- **Metadata inclusion** for tracking data source and timing
- **Improved error handling** and response format

### 6. Updated Kafka API (`digital-twin-client/src/app/api/kafka/route.ts`)

- **Support for custom sensor data** from replay API
- **Metadata handling** for tracking data sources
- **Enhanced message format** with processing timestamps

### 7. Updated Predict API (`digital-twin-client/src/app/api/ml/predict/route.ts`)

- **Uses enhanced prediction endpoint** (`/predict-enhanced`)
- **Returns comprehensive results** with anomaly detection

## API Endpoints

### Enhanced Prediction Endpoint
```
POST /predict-enhanced
```

**Request:**
```json
{
  "date": "2024-01-01T12:00:00Z",
  "Temperature": 23.5,
  "Humidity": 45.2,
  "Light": 500,
  "CO2": 600,
  "HumidityRatio": 0.008
}
```

**Response:**
```json
{
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
  "metadata": null
}
```

### Kafka Result Endpoint
```
POST /kafka-result
```

Receives processed results from the Kafka consumer and validates the format.

## Anomaly Detection

The system uses a **combined anomaly detection approach**:

1. **Statistical Methods**: Z-score and IQR-based outlier detection
2. **Domain Thresholds**: Sensor-specific value ranges
3. **Machine Learning**: Isolation Forest for complex pattern detection

**Configuration:**
- Contamination rate: 10%
- Z-score threshold: 3.0
- IQR multiplier: 1.5

## Kafka Integration

### Message Format
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

### Processing Flow
1. **Replay API** sends sensor data to Kafka
2. **Enhanced Kafka Consumer** processes the message
3. **Anomaly Detection** analyzes the data
4. **Occupancy Prediction** runs the ML model
5. **Results** are logged and can be sent to webhooks or databases

## Usage Examples

### Using the Enhanced Replay System

1. **List available data files:**
   ```bash
   GET /api/replay?action=list-files
   ```

2. **Send data to Kafka for processing:**
   ```bash
   POST /api/replay
   {
     "action": "send-kafka-message",
     "filename": "datatest.txt",
     "time": "2024-01-01T12:00:00Z"
   }
   ```

3. **Make enhanced prediction:**
   ```bash
   POST /api/ml/predict
   {
     "date": "2024-01-01T12:00:00Z",
     "Temperature": 23.5,
     "Humidity": 45.2,
     "Light": 500,
     "CO2": 600,
     "HumidityRatio": 0.008
   }
   ```

## Configuration

### Environment Variables
- `ENABLE_KAFKA=true` - Enable Kafka consumer
- `KAFKA_BOOTSTRAP_SERVERS=localhost:9092` - Kafka broker address
- `KAFKA_TOPIC=test-topic` - Kafka topic name
- `KAFKA_GROUP_ID=occupancy-ml-consumer` - Consumer group ID

### Model Configuration
- Anomaly detection uses the `occ_v2` model artifacts
- Supports both legacy and enhanced prediction modes
- Automatic fallback to legacy consumer if enhanced consumer fails

## Benefits

1. **Real-time Processing**: Kafka enables real-time data processing
2. **Anomaly Detection**: Identifies problematic data before prediction
3. **Comprehensive Results**: Rich response format with all necessary information
4. **Scalability**: Kafka-based architecture supports high-throughput processing
5. **Reliability**: Fallback mechanisms ensure system stability
6. **Monitoring**: Detailed logging and error handling for observability

## Future Enhancements

- **WebSocket Integration**: Real-time result streaming to web clients
- **Database Storage**: Persistent storage of prediction results
- **Alert System**: Notifications for anomalies and prediction failures
- **Metrics Dashboard**: Real-time monitoring of system performance
- **Model Versioning**: Support for multiple model versions
