#!/bin/bash

# Development Mode Management Script
# This script helps manage the development environment where:
# - Kafka runs in Docker
# - ML API runs locally
# - Next.js runs locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :$1 >/dev/null 2>&1
}

# Function to start development environment
start_dev() {
    print_status "Starting Development Environment..."
    print_status "Mode: Kafka in Docker, ML API local, Next.js local"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Start Kafka in Docker
    print_status "Starting Kafka broker in Docker..."
    docker-compose up -d broker
    
    # Wait for Kafka to be ready
    print_status "Waiting for Kafka to be ready..."
    sleep 10
    
    # Check if ML API port is available
    if port_in_use 8000; then
        print_warning "Port 8000 is already in use. Please stop the service using this port."
        exit 1
    fi
    
    # Check if Next.js port is available
    if port_in_use 3000; then
        print_warning "Port 3000 is already in use. Please stop the service using this port."
        exit 1
    fi
    
    # Copy development environment file
    print_status "Setting up development environment..."
    cp env.development .env
    
    # Start ML API locally
    print_status "Starting ML API locally..."
    if command_exists python3; then
        python3 run_local.py &
        ML_API_PID=$!
        echo $ML_API_PID > .ml_api.pid
        print_success "ML API started with PID: $ML_API_PID"
        
        # Wait a moment for ML API to start
        sleep 3
        
        # Check if ML API is responding
        if curl -s http://localhost:8000/health >/dev/null 2>&1; then
            print_success "ML API is responding"
        else
            print_warning "ML API may not be ready yet"
        fi
    else
        print_error "Python 3 is not installed or not in PATH."
        exit 1
    fi
    
    # Start Next.js locally
    print_status "Starting Next.js client locally..."
    cd digital-twin-client
    cp env.development .env.local
    if command_exists npm; then
        npm run dev &
        NEXTJS_PID=$!
        echo $NEXTJS_PID > ../.nextjs.pid
        cd ..
        print_success "Next.js started with PID: $NEXTJS_PID"
    else
        print_error "npm is not installed or not in PATH."
        exit 1
    fi
    
    print_success "Development environment started successfully!"
    print_status "Services:"
    print_status "  - Kafka: http://localhost:9092 (Docker)"
    print_status "  - ML API: http://localhost:8000 (Local)"
    print_status "  - Next.js: http://localhost:3000 (Local)"
    print_status "  - ML API Docs: http://localhost:8000/docs"
}

# Function to stop development environment
stop_dev() {
    print_status "Stopping Development Environment..."
    
    # Stop local services
    if [ -f .ml_api.pid ]; then
        ML_API_PID=$(cat .ml_api.pid)
        if kill -0 $ML_API_PID 2>/dev/null; then
            print_status "Stopping ML API (PID: $ML_API_PID)..."
            kill $ML_API_PID
            rm .ml_api.pid
        fi
    fi
    
    if [ -f .nextjs.pid ]; then
        NEXTJS_PID=$(cat .nextjs.pid)
        if kill -0 $NEXTJS_PID 2>/dev/null; then
            print_status "Stopping Next.js (PID: $NEXTJS_PID)..."
            kill $NEXTJS_PID
            rm .nextjs.pid
        fi
    fi
    
    # Stop Docker services
    print_status "Stopping Kafka broker..."
    docker-compose down
    
    print_success "Development environment stopped successfully!"
}

# Function to show status
status_dev() {
    print_status "Development Environment Status:"
    
    # Check Kafka
    if docker-compose ps broker | grep -q "Up"; then
        print_success "Kafka: Running (Docker)"
    else
        print_error "Kafka: Not running"
    fi
    
    # Check ML API
    if [ -f .ml_api.pid ]; then
        ML_API_PID=$(cat .ml_api.pid)
        if kill -0 $ML_API_PID 2>/dev/null; then
            print_success "ML API: Running (Local, PID: $ML_API_PID)"
        else
            print_error "ML API: Not running (stale PID file)"
            rm .ml_api.pid
        fi
    else
        print_error "ML API: Not running"
    fi
    
    # Check Next.js
    if [ -f .nextjs.pid ]; then
        NEXTJS_PID=$(cat .nextjs.pid)
        if kill -0 $NEXTJS_PID 2>/dev/null; then
            print_success "Next.js: Running (Local, PID: $NEXTJS_PID)"
        else
            print_error "Next.js: Not running (stale PID file)"
            rm .nextjs.pid
        fi
    else
        print_error "Next.js: Not running"
    fi
}

# Function to show logs
logs_dev() {
    print_status "Showing logs for development environment..."
    
    if [ -f .ml_api.pid ]; then
        ML_API_PID=$(cat .ml_api.pid)
        if kill -0 $ML_API_PID 2>/dev/null; then
            print_status "ML API logs (PID: $ML_API_PID):"
            # Note: This won't show logs as the process is running in background
            print_warning "ML API logs are not available in background mode"
        fi
    fi
    
    print_status "Kafka logs:"
    docker-compose logs broker
}

# Main script logic
case "${1:-}" in
    start)
        start_dev
        ;;
    stop)
        stop_dev
        ;;
    restart)
        stop_dev
        sleep 2
        start_dev
        ;;
    status)
        status_dev
        ;;
    logs)
        logs_dev
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start   - Start development environment (Kafka in Docker, ML API & Next.js local)"
        echo "  stop    - Stop development environment"
        echo "  restart - Restart development environment"
        echo "  status  - Show status of all services"
        echo "  logs    - Show logs"
        echo ""
        echo "Development Mode:"
        echo "  - Kafka broker runs in Docker container"
        echo "  - ML API runs locally on port 8000"
        echo "  - Next.js runs locally on port 3000"
        exit 1
        ;;
esac
