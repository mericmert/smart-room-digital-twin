#!/bin/bash
# Docker testing script for Occupancy ML API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to wait for service to be ready
wait_for_service() {
    local url="$1"
    local service_name="$2"
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            print_status "$service_name is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start after $max_attempts attempts"
    return 1
}

# Function to test API endpoints
test_api_endpoints() {
    local base_url="$1"
    
    print_header "Testing API Endpoints"
    
    # Test health endpoint
    print_status "Testing health endpoint..."
    response=$(curl -s "$base_url/health")
    if echo "$response" | grep -q "ok"; then
        print_status "✓ Health endpoint working"
    else
        print_error "✗ Health endpoint failed"
        echo "Response: $response"
        return 1
    fi
    
    # Test detailed health endpoint
    print_status "Testing detailed health endpoint..."
    response=$(curl -s "$base_url/health/detailed")
    if echo "$response" | grep -q "api_status"; then
        print_status "✓ Detailed health endpoint working"
    else
        print_error "✗ Detailed health endpoint failed"
        echo "Response: $response"
        return 1
    fi
    
    # Test prediction endpoint
    print_status "Testing prediction endpoint..."
    prediction_data='{
        "date": "2023-01-01T12:00:00",
        "Temperature": 22.0,
        "Humidity": 45.0,
        "Light": 250.0,
        "CO2": 450.0,
        "HumidityRatio": 0.012
    }'
    
    response=$(curl -s -X POST "$base_url/predict" \
        -H "Content-Type: application/json" \
        -d "$prediction_data")
    
    if echo "$response" | grep -q "occupancy"; then
        print_status "✓ Prediction endpoint working"
        echo "Response: $response"
    else
        print_error "✗ Prediction endpoint failed"
        echo "Response: $response"
        return 1
    fi
}

# Function to test Kafka integration
test_kafka_integration() {
    print_header "Testing Kafka Integration"
    
    # Check if Kafka topics exist
    print_status "Checking Kafka topics..."
    topics=$(docker-compose exec -T broker kafka-topics --bootstrap-server localhost:9092 --list)
    
    if echo "$topics" | grep -q "docker-occupancy-data"; then
        print_status "✓ Kafka topic 'docker-occupancy-data' exists"
    else
        print_error "✗ Kafka topic 'docker-occupancy-data' not found"
        return 1
    fi
    
    # Send test message to Kafka
    print_status "Sending test message to Kafka..."
    test_message='{
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'",
        "Temperature": 23.5,
        "Humidity": 50.0,
        "Light": 300.0,
        "CO2": 500.0,
        "HumidityRatio": 0.013
    }'
    
    echo "$test_message" | docker-compose exec -T broker kafka-console-producer \
        --bootstrap-server localhost:9092 \
        --topic docker-occupancy-data
    
    print_status "✓ Test message sent to Kafka"
}

# Function to run container tests
run_container_tests() {
    print_header "Running Container Tests"
    
    print_status "Running unit tests..."
    docker-compose exec occupancy-api python -m pytest test_model_api.py -v
    
    if [ $? -eq 0 ]; then
        print_status "✓ Unit tests passed"
    else
        print_error "✗ Unit tests failed"
        return 1
    fi
}

# Main testing function
main() {
    print_header "Docker Integration Testing"
    
    # Start services
    print_status "Starting services..."
    docker-compose up -d
    
    # Wait for services to be ready
    wait_for_service "http://localhost:8000/health" "API"
    wait_for_service "http://localhost:9092" "Kafka"
    
    # Run tests
    test_api_endpoints "http://localhost:8000"
    test_kafka_integration
    run_container_tests
    
    print_header "All Tests Completed Successfully!"
    print_status "API is running at: http://localhost:8000"
    print_status "API docs at: http://localhost:8000/docs"
    print_status "Health check: http://localhost:8000/health"
}

# Cleanup function
cleanup() {
    print_status "Cleaning up..."
    docker-compose down
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"
