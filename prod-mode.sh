#!/bin/bash

# Production Mode Management Script
# This script helps manage the production environment where:
# - Kafka runs in Docker
# - ML API runs in Docker
# - Next.js runs in Docker

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

# Function to start production environment
start_prod() {
    print_status "Starting Production Environment..."
    print_status "Mode: All services (Kafka, ML API, Next.js) in Docker"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_error "docker-compose is not installed or not in PATH."
        exit 1
    fi
    
    # Copy production environment file
    print_status "Setting up production environment..."
    cp env.production .env
    
    # Copy Next.js production environment file
    cp digital-twin-client/env.production digital-twin-client/.env.local
    
    # Build and start all services
    print_status "Building and starting all services..."
    docker-compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --build
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 15
    
    # Check service health
    print_status "Checking service health..."
    
    # Check Kafka
    if docker-compose ps broker | grep -q "Up"; then
        print_success "Kafka: Running"
    else
        print_error "Kafka: Failed to start"
    fi
    
    # Check ML API
    if docker-compose ps occupancy-api | grep -q "Up"; then
        print_success "ML API: Running"
    else
        print_error "ML API: Failed to start"
    fi
    
    # Check Next.js
    if docker-compose ps digital-twin-client | grep -q "Up"; then
        print_success "Next.js: Running"
    else
        print_error "Next.js: Failed to start"
    fi
    
    print_success "Production environment started successfully!"
    print_status "Services:"
    print_status "  - Kafka: http://localhost:9092"
    print_status "  - ML API: http://localhost:8000"
    print_status "  - Next.js: http://localhost:3000"
    print_status "  - ML API Docs: http://localhost:8000/docs"
}

# Function to stop production environment
stop_prod() {
    print_status "Stopping Production Environment..."
    
    # Stop all services
    docker-compose -f docker-compose.yaml -f docker-compose.prod.yml down
    
    print_success "Production environment stopped successfully!"
}

# Function to show status
status_prod() {
    print_status "Production Environment Status:"
    
    # Show status of all services
    docker-compose -f docker-compose.yaml -f docker-compose.prod.yml ps
}

# Function to show logs
logs_prod() {
    print_status "Showing logs for production environment..."
    
    if [ -n "${2:-}" ]; then
        # Show logs for specific service
        docker-compose -f docker-compose.yaml -f docker-compose.prod.yml logs -f "$2"
    else
        # Show logs for all services
        docker-compose -f docker-compose.yaml -f docker-compose.prod.yml logs -f
    fi
}

# Function to restart a specific service
restart_service() {
    if [ -z "${2:-}" ]; then
        print_error "Please specify a service name to restart"
        echo "Available services: broker, occupancy-api, digital-twin-client"
        exit 1
    fi
    
    print_status "Restarting service: $2"
    docker-compose -f docker-compose.yaml -f docker-compose.prod.yml restart "$2"
    print_success "Service $2 restarted successfully!"
}

# Function to scale services
scale_prod() {
    if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
        print_error "Please specify service name and number of replicas"
        echo "Usage: $0 scale <service> <replicas>"
        echo "Available services: occupancy-api, digital-twin-client"
        exit 1
    fi
    
    print_status "Scaling service $2 to $3 replicas..."
    docker-compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --scale "$2=$3"
    print_success "Service $2 scaled to $3 replicas!"
}

# Function to update services
update_prod() {
    print_status "Updating Production Environment..."
    
    # Pull latest images
    print_status "Pulling latest images..."
    docker-compose -f docker-compose.yaml -f docker-compose.prod.yml pull
    
    # Rebuild and restart services
    print_status "Rebuilding and restarting services..."
    docker-compose -f docker-compose.yaml -f docker-compose.prod.yml up -d --build
    
    print_success "Production environment updated successfully!"
}

# Main script logic
case "${1:-}" in
    start)
        start_prod
        ;;
    stop)
        stop_prod
        ;;
    restart)
        stop_prod
        sleep 2
        start_prod
        ;;
    status)
        status_prod
        ;;
    logs)
        logs_prod "$@"
        ;;
    restart-service)
        restart_service "$@"
        ;;
    scale)
        scale_prod "$@"
        ;;
    update)
        update_prod
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|restart-service|scale|update}"
        echo ""
        echo "Commands:"
        echo "  start           - Start production environment (all services in Docker)"
        echo "  stop            - Stop production environment"
        echo "  restart         - Restart production environment"
        echo "  status          - Show status of all services"
        echo "  logs [service]  - Show logs (optionally for specific service)"
        echo "  restart-service <service> - Restart a specific service"
        echo "  scale <service> <replicas> - Scale a service to specified replicas"
        echo "  update          - Update and restart all services"
        echo ""
        echo "Available services: broker, occupancy-api, digital-twin-client"
        echo ""
        echo "Production Mode:"
        echo "  - Kafka broker runs in Docker container"
        echo "  - ML API runs in Docker container"
        echo "  - Next.js runs in Docker container"
        exit 1
        ;;
esac
