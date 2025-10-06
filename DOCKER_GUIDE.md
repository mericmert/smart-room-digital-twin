# Docker Deployment Guide

This guide explains how to deploy and manage the Occupancy ML API using Docker.

## 🐳 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available

### Start the API
```bash
# Start in development mode
./docker-manage.sh up -e development

# Start in production mode
./docker-manage.sh up -e production
```

## 📋 Services Overview

| Service | Port | Description |
|---------|------|-------------|
| `broker` | 9092 | Apache Kafka broker |
| `occupancy-api` | 8000 | ML API (production) |
| `occupancy-api-dev` | 8001 | ML API (development) |
| `kafka-producer` | - | Kafka topic creator (testing) |

## 🚀 Deployment Options

### Development Mode
```bash
# Start with hot reload
./docker-manage.sh up -e development

# View logs
./docker-manage.sh logs -s occupancy-api

# Stop services
./docker-manage.sh down -e development
```

### Production Mode
```bash
# Start production services
./docker-manage.sh up -e production

# Check status
./docker-manage.sh status -e production

# Restart if needed
./docker-manage.sh restart -e production
```

## 🧪 Testing

### Run Integration Tests
```bash
# Run comprehensive tests
./docker-test.sh
```

### Manual Testing
```bash
# Test health endpoint
curl http://localhost:8000/health

# Test prediction
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2023-01-01T12:00:00",
    "Temperature": 22.0,
    "Humidity": 45.0,
    "Light": 250.0,
    "CO2": 450.0,
    "HumidityRatio": 0.012
  }'
```

## 🔧 Management Commands

### Service Management
```bash
# Start services
./docker-manage.sh up

# Stop services
./docker-manage.sh down

# Restart services
./docker-manage.sh restart

# Build images
./docker-manage.sh build

# View logs
./docker-manage.sh logs

# Check status
./docker-manage.sh status
```

### Environment-Specific Commands
```bash
# Development
./docker-manage.sh up -e development
./docker-manage.sh logs -e development

# Production
./docker-manage.sh up -e production
./docker-manage.sh logs -e production
```

### Service-Specific Commands
```bash
# Target specific services
./docker-manage.sh logs -s occupancy-api
./docker-manage.sh restart -s broker
```

## 📊 Monitoring

### Health Checks
- **API Health**: `http://localhost:8000/health`
- **Detailed Health**: `http://localhost:8000/health/detailed`
- **API Documentation**: `http://localhost:8000/docs`

### Metrics (if enabled)
- **Metrics Endpoint**: `http://localhost:9090/metrics`

### Logs
```bash
# All services
./docker-manage.sh logs

# Specific service
./docker-manage.sh logs -s occupancy-api

# Follow logs
docker-compose logs -f occupancy-api
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Check if ports are in use
netstat -tulpn | grep :8000
netstat -tulpn | grep :9092

# Use different ports in docker-compose.yaml
```

#### 2. Model Loading Issues
```bash
# Check if model artifacts exist
ls -la artifacts/occ_v1/

# Verify model files
docker-compose exec occupancy-api ls -la /app/artifacts/occ_v1/
```

#### 3. Kafka Connection Issues
```bash
# Check Kafka status
docker-compose exec broker kafka-topics --bootstrap-server localhost:9092 --list

# Test Kafka connectivity
docker-compose exec occupancy-api python -c "
from kafka import KafkaProducer
producer = KafkaProducer(bootstrap_servers='broker:9092')
print('Kafka connection successful')
"
```

#### 4. Memory Issues
```bash
# Check container resource usage
docker stats

# Increase memory limits in docker-compose.yaml
```

### Debug Mode
```bash
# Start with debug logging
docker-compose --profile local-dev up

# Access container shell
docker-compose exec occupancy-api bash
```

## 🔒 Security Considerations

### Production Security
- **API Key**: Set `API_KEY` environment variable
- **Rate Limiting**: Enable `ENABLE_RATE_LIMITING=true`
- **CORS**: Disable `ENABLE_CORS=false`
- **Debug**: Disable `DEBUG=false`

### Network Security
- Use Docker networks for service isolation
- Expose only necessary ports
- Use secrets management for sensitive data

## 📈 Performance Tuning

### Resource Limits
```yaml
# In docker-compose.prod.yml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

### Scaling
```bash
# Scale API service
docker-compose up --scale occupancy-api=3

# Use load balancer for multiple instances
```

## 🗂️ File Structure

```
.
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yaml       # Main configuration with profiles
├── docker-compose.prod.yml   # Production overrides
├── docker-manage.sh          # Management script
├── docker-test.sh            # Testing script
├── .dockerignore             # Docker ignore file
└── env.docker                # Docker environment variables
```

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Docker Build and Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and test
        run: |
          ./docker-manage.sh build -e development
          ./docker-test.sh
```

### Docker Registry
```bash
# Build and push to registry
docker build -t your-registry/occupancy-ml-api:latest .
docker push your-registry/occupancy-ml-api:latest
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [FastAPI Docker Guide](https://fastapi.tiangolo.com/deployment/docker/)
- [Kafka Docker Setup](https://kafka.apache.org/quickstart)
- [Environment Variables Guide](./ENVIRONMENT_VARIABLES.md)
