# Digital Twin Project - Development & Production Modes

This project supports two distinct operational modes:

## 🚀 Local Development Mode
- **Kafka**: Runs in Docker container
- **ML API**: Runs locally on your machine
- **Next.js**: Runs locally on your machine

## 🛠️ Development Mode
- **Kafka**: Runs in Docker container
- **ML API**: Runs in Docker container (development configuration)
- **Next.js**: Runs in Docker container (development configuration)

## 🏭 Production Mode
- **Kafka**: Runs in Docker container
- **ML API**: Runs in Docker container (production configuration)
- **Next.js**: Runs in Docker container (production configuration)

## Quick Start

### Local Development Mode (Recommended for Development)
```bash
# Start local development environment (Kafka in Docker, ML API & Next.js local)
./dev-mode.sh start

# Check status
./dev-mode.sh status

# Stop local development environment
./dev-mode.sh stop
```

### Development Mode (Full Docker Stack)
```bash
# Start development environment (all services in Docker)
docker-compose --profile development up -d

# Check status
docker-compose --profile development ps

# Stop development environment
docker-compose --profile development down
```

### Production Mode
```bash
# Start production environment
./prod-mode.sh start

# Check status
./prod-mode.sh status

# Stop production environment
./prod-mode.sh stop
```

### Other Modes
```bash
# Local development (Kafka only)
docker-compose --profile local-dev up -d

# Testing mode (Kafka + test utilities)
docker-compose --profile testing up -d

# All services
docker-compose --profile full up -d
```

## Detailed Configuration

### Local Development Mode (Recommended)

#### Prerequisites
- Docker installed and running
- Python 3.x installed
- Node.js and npm installed

#### Services
- **Kafka**: `localhost:9092` (Docker)
- **ML API**: `localhost:8000` (Local)
- **Next.js**: `localhost:3000` (Local)

#### Environment Files
- Main project: `env.development`
- Next.js client: `digital-twin-client/env.development`

#### Starting Local Development Mode
```bash
# Start all services (Kafka in Docker, ML API & Next.js local)
./dev-mode.sh start

# Check status
./dev-mode.sh status

# Stop all services
./dev-mode.sh stop

# Restart all services
./dev-mode.sh restart

# View logs
./dev-mode.sh logs
```

### Development Mode (Full Docker Stack)

#### Prerequisites
- Docker installed and running
- Docker Compose installed

#### Services
- **Kafka**: `localhost:9092` (Docker)
- **ML API**: `localhost:8001` (Docker)
- **Next.js**: `localhost:3001` (Docker)

#### Starting Development Mode
```bash
# Start all services in Docker
docker-compose --profile development up -d

# Check status
docker-compose --profile development ps

# Stop services
docker-compose --profile development down

# View logs
docker-compose --profile development logs
```

### Production Mode

#### Prerequisites
- Docker installed and running
- Docker Compose installed

#### Services
- **Kafka**: `localhost:9092` (Docker)
- **ML API**: `localhost:8000` (Docker)
- **Next.js**: `localhost:3000` (Docker)

#### Environment Files
- Main project: `env.production`
- Next.js client: `digital-twin-client/env.production`

#### Starting Production Mode
```bash
# Start all services in Docker
docker-compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --build
```

#### Production Mode Management
```bash
# Start all services
./prod-mode.sh start

# Stop all services
./prod-mode.sh stop

# Restart all services
./prod-mode.sh restart

# Check service status
./prod-mode.sh status

# View logs (all services)
./prod-mode.sh logs

# View logs (specific service)
./prod-mode.sh logs occupancy-api

# Restart specific service
./prod-mode.sh restart-service occupancy-api

# Scale service
./prod-mode.sh scale occupancy-api 3

# Update all services
./prod-mode.sh update
```

## Environment Configuration

### Development Environment Variables

#### Main Project (`env.development`)
```bash
# Kafka Configuration (Kafka runs in Docker, accessible via localhost)
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_TOPIC=dev-occupancy-data
KAFKA_GROUP_ID=dev-occupancy-consumer

# API Configuration (ML API runs locally)
API_HOST=127.0.0.1
API_PORT=8000
LOG_LEVEL=DEBUG
DEBUG=true
ENABLE_CORS=true
```

#### Next.js Client (`digital-twin-client/env.development`)
```bash
# ML API Configuration (ML API runs locally)
ML_API_URL=http://localhost:8000
ML_API_WS_URL=ws://localhost:8000/ws

# Kafka Configuration (Kafka runs in Docker, accessible via localhost)
KAFKA_BROKER_URL=localhost:9092
KAFKA_TOPIC=dev-occupancy-data

# Next.js Configuration (Next.js runs locally)
NEXT_PUBLIC_ML_API_URL=http://localhost:8000
NEXT_PUBLIC_ML_API_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_KAFKA_TOPIC=dev-occupancy-data
```

### Production Environment Variables

#### Main Project (`env.production`)
```bash
# Kafka Configuration (all services in Docker network)
KAFKA_BOOTSTRAP_SERVERS=broker:9092
KAFKA_TOPIC=prod-occupancy-sensor-data
KAFKA_GROUP_ID=prod-occupancy-ml-consumer

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
DEBUG=false
ENABLE_CORS=false
```

#### Next.js Client (`digital-twin-client/env.production`)
```bash
# ML API Configuration (ML API runs in Docker)
ML_API_URL=http://occupancy-api:8000
ML_API_WS_URL=ws://occupancy-api:8000/ws

# Kafka Configuration (Kafka runs in Docker)
KAFKA_BROKER_URL=broker:9092
KAFKA_TOPIC=prod-occupancy-sensor-data

# Next.js Configuration (Next.js runs in Docker, but public URLs point to localhost)
NEXT_PUBLIC_ML_API_URL=http://localhost:8000
NEXT_PUBLIC_ML_API_WS_URL=ws://localhost:8000/ws
NEXT_PUBLIC_KAFKA_TOPIC=prod-occupancy-sensor-data
```

## Docker Compose Profiles

### Profile Structure (`docker-compose.yaml`)
The main `docker-compose.yaml` file now uses profiles to organize services:

- **`local-dev`**: Kafka only (for local development with ML API and Next.js running locally)
- **`development`**: Full development stack in Docker (Kafka + ML API + Next.js)
- **`production`**: Full production stack in Docker (Kafka + ML API + Next.js)
- **`testing`**: Kafka + test utilities
- **`full`**: All services (development + production)

### Service Organization
- **Kafka Broker**: Available in all profiles
- **ML API Production**: `production`, `full` profiles
- **ML API Development**: `development`, `full` profiles
- **Next.js Production**: `production`, `full` profiles
- **Next.js Development**: `development`, `full` profiles
- **Kafka Producer**: `testing`, `local-dev` profiles

### Production Configuration (`docker-compose.prod.yml`)
- Production-optimized settings
- Resource limits and restart policies
- Used with `--profile production`

## Service URLs

### Local Development Mode
- **Kafka**: `localhost:9092`
- **ML API**: `http://localhost:8000` (Local)
- **ML API Docs**: `http://localhost:8000/docs`
- **Next.js**: `http://localhost:3000` (Local)

### Development Mode (Docker)
- **Kafka**: `localhost:9092`
- **ML API**: `http://localhost:8001` (Docker)
- **ML API Docs**: `http://localhost:8001/docs`
- **Next.js**: `http://localhost:3001` (Docker)

### Production Mode
- **Kafka**: `localhost:9092`
- **ML API**: `http://localhost:8000` (Docker)
- **ML API Docs**: `http://localhost:8000/docs`
- **Next.js**: `http://localhost:3000` (Docker)

## Troubleshooting

### Development Mode Issues

#### Port Already in Use
```bash
# Check what's using port 8000
lsof -i :8000

# Check what's using port 3000
lsof -i :3000

# Kill processes if needed
kill -9 <PID>
```

#### Kafka Connection Issues
```bash
# Check if Kafka is running
docker-compose ps broker

# Check Kafka logs
docker-compose logs broker

# Restart Kafka
docker-compose restart broker
```

### Production Mode Issues

#### Service Health Checks
```bash
# Check all services
./prod-mode.sh status

# Check specific service logs
./prod-mode.sh logs occupancy-api

# Restart specific service
./prod-mode.sh restart-service occupancy-api
```

#### Resource Issues
```bash
# Check Docker resource usage
docker stats

# Scale services if needed
./prod-mode.sh scale occupancy-api 2
```

## Switching Between Modes

### From Development to Production
1. Stop development environment:
   ```bash
   ./dev-mode.sh stop
   ```

2. Start production environment:
   ```bash
   ./prod-mode.sh start
   ```

### From Production to Development
1. Stop production environment:
   ```bash
   ./prod-mode.sh stop
   ```

2. Start development environment:
   ```bash
   ./dev-mode.sh start
   ```

## Monitoring and Logs

### Development Mode
- ML API logs: Available in terminal where `run_local.py` is running
- Next.js logs: Available in terminal where `npm run dev` is running
- Kafka logs: `docker-compose logs broker`

### Production Mode
- All service logs: `./prod-mode.sh logs`
- Specific service logs: `./prod-mode.sh logs <service-name>`
- Service status: `./prod-mode.sh status`

## Performance Considerations

### Development Mode
- Optimized for development speed
- Hot reload enabled
- Debug logging enabled
- Relaxed performance settings

### Production Mode
- Optimized for performance and reliability
- Resource limits configured
- Health checks enabled
- Restart policies configured
- Rate limiting enabled
