# Environment Variables Documentation

This document describes all environment variables used by the Occupancy ML API.

## 📋 Quick Start

1. **Copy the example file:**
   ```bash
   cp env.example .env
   ```

2. **Edit the .env file with your settings:**
   ```bash
   nano .env
   ```

3. **Use the management script:**
   ```bash
   python manage_env.py create development
   ```

## 🔧 Configuration Categories

### Model Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `OCC_MODEL_DIR` | `../artifacts/occ_v1` | Path to model artifacts directory |
| `MODEL_VALIDATION_ENABLED` | `true` | Enable model validation during startup |
| `MODEL_RELOAD_ON_ERROR` | `false` | Enable automatic model reload on errors |

### Kafka Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Kafka broker addresses (comma-separated) |
| `KAFKA_TOPIC` | `test-topic` | Kafka topic name for sensor data |
| `KAFKA_GROUP_ID` | `occupancy-ml-consumer` | Kafka consumer group ID |

### API Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_HOST` | `0.0.0.0` | API server host address |
| `API_PORT` | `8000` | API server port |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |

### Performance Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_PREDICTION_BATCH_SIZE` | `100` | Maximum batch size for predictions |
| `PREDICTION_TIMEOUT_SECONDS` | `30` | Prediction timeout in seconds |

### Development Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `false` | Enable debug mode (additional logging) |
| `ENABLE_CORS` | `false` | Enable CORS for development |

### Monitoring Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_METRICS` | `false` | Enable metrics collection |
| `METRICS_PORT` | `9090` | Metrics export port |

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEY` | `` | API key for authentication (empty = disabled) |
| `ENABLE_RATE_LIMITING` | `false` | Enable request rate limiting |
| `RATE_LIMIT_PER_MINUTE` | `1000` | Rate limit requests per minute |

## 🚀 Environment-Specific Configurations

### Development Environment
```bash
# Use development settings
python manage_env.py create development
```

**Key settings:**
- `DEBUG=true`
- `LOG_LEVEL=DEBUG`
- `ENABLE_CORS=true`
- `MODEL_RELOAD_ON_ERROR=true`

### Production Environment
```bash
# Use production settings
python manage_env.py create production
```

**Key settings:**
- `DEBUG=false`
- `LOG_LEVEL=INFO`
- `ENABLE_RATE_LIMITING=true`
- `MODEL_RELOAD_ON_ERROR=false`

### Docker Environment
```bash
# Use Docker settings
python manage_env.py create docker
```

**Key settings:**
- `KAFKA_BOOTSTRAP_SERVERS=kafka:9092`
- `API_HOST=0.0.0.0`
- `ENABLE_METRICS=true`

## 🛠️ Management Commands

### Show Current Configuration
```bash
python manage_env.py config
```

### Validate Configuration
```bash
python manage_env.py validate
```

### Show Environment Variables
```bash
python manage_env.py env-vars
```

### Create Environment File
```bash
python manage_env.py create development
python manage_env.py create production
python manage_env.py create docker
```

## 📝 Examples

### Local Development
```bash
# .env file for local development
OCC_MODEL_DIR=./artifacts/occ_v1
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_TOPIC=dev-occupancy-data
API_HOST=127.0.0.1
API_PORT=8000
LOG_LEVEL=DEBUG
DEBUG=true
ENABLE_CORS=true
```

### Production Deployment
```bash
# .env file for production
OCC_MODEL_DIR=/opt/ml/models/occupancy/v1
KAFKA_BOOTSTRAP_SERVERS=kafka-1:9092,kafka-2:9092,kafka-3:9092
KAFKA_TOPIC=prod-occupancy-sensor-data
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
DEBUG=false
ENABLE_RATE_LIMITING=true
API_KEY=your-secure-api-key-here
```

### Docker Compose
```bash
# docker-compose.yml environment section
environment:
  - OCC_MODEL_DIR=/app/artifacts/occ_v1
  - KAFKA_BOOTSTRAP_SERVERS=kafka:9092
  - KAFKA_TOPIC=docker-occupancy-data
  - API_HOST=0.0.0.0
  - API_PORT=8000
  - LOG_LEVEL=INFO
  - ENABLE_METRICS=true
```

## 🔍 Troubleshooting

### Common Issues

1. **Model directory not found**
   ```bash
   # Check if the path exists
   ls -la $OCC_MODEL_DIR
   
   # Use absolute path
   OCC_MODEL_DIR=/absolute/path/to/artifacts/occ_v1
   ```

2. **Kafka connection issues**
   ```bash
   # Test Kafka connectivity
   python -c "from kafka import KafkaProducer; KafkaProducer(bootstrap_servers='$KAFKA_BOOTSTRAP_SERVERS')"
   ```

3. **Port conflicts**
   ```bash
   # Check if port is available
   netstat -tulpn | grep :8000
   
   # Use different port
   API_PORT=8001
   ```

### Validation
```bash
# Validate your configuration
python manage_env.py validate
```

## 📚 Best Practices

1. **Never commit .env files** - Add to `.gitignore`
2. **Use different files for different environments** - `.env.development`, `.env.production`
3. **Set secure API keys** - Use strong, random keys for production
4. **Monitor resource usage** - Adjust batch sizes and timeouts based on your infrastructure
5. **Use environment-specific Kafka topics** - Separate dev/prod data streams

## 🔐 Security Notes

- **API_KEY**: Use strong, random keys (32+ characters)
- **Kafka**: Use SASL/SSL in production
- **CORS**: Only enable in development
- **Rate Limiting**: Enable in production to prevent abuse
