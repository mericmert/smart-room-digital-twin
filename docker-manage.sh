#!/bin/bash
# Docker management script for Occupancy ML API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
ACTION="up"
SERVICES=""

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE} $1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [ACTION] [OPTIONS]"
    echo ""
    echo "ACTIONS:"
    echo "  up          Start services (default)"
    echo "  down        Stop services"
    echo "  restart     Restart services"
    echo "  build       Build images"
    echo "  logs        Show logs"
    echo "  status      Show service status"
    echo "  clean       Clean up containers and images"
    echo "  test        Run tests"
    echo ""
    echo "OPTIONS:"
    echo "  -e, --env ENV     Environment (development|production|local-dev|testing|full) [default: development]"
    echo "  -s, --services    Specific services to target"
    echo "  -h, --help        Show this help"
    echo ""
    echo "ENVIRONMENTS:"
    echo "  development  Full development stack in Docker (Kafka + ML API + Next.js)"
    echo "  production   Full production stack in Docker (Kafka + ML API + Next.js)"
    echo "  local-dev    Kafka only (for local development with ML API and Next.js running locally)"
    echo "  testing      Kafka + test utilities"
    echo "  full         All services (development + production)"
    echo ""
    echo "EXAMPLES:"
    echo "  $0 up -e development"
    echo "  $0 up -e local-dev"
    echo "  $0 logs -s occupancy-api"
    echo "  $0 build -e production"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        up|down|restart|build|logs|status|clean|test)
            ACTION="$1"
            shift
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--services)
            SERVICES="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "local-dev" && "$ENVIRONMENT" != "testing" && "$ENVIRONMENT" != "full" ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    print_error "Valid environments: development, production, local-dev, testing, full"
    exit 1
fi

# Set compose files and profiles based on environment
COMPOSE_FILES="-f docker-compose.yaml"
if [[ "$ENVIRONMENT" == "development" ]]; then
    COMPOSE_PROFILE="--profile development"
elif [[ "$ENVIRONMENT" == "production" ]]; then
    COMPOSE_PROFILE="--profile production"
elif [[ "$ENVIRONMENT" == "local-dev" ]]; then
    COMPOSE_PROFILE="--profile local-dev"
elif [[ "$ENVIRONMENT" == "testing" ]]; then
    COMPOSE_PROFILE="--profile testing"
elif [[ "$ENVIRONMENT" == "full" ]]; then
    COMPOSE_PROFILE="--profile full"
else
    COMPOSE_PROFILE=""
fi

# Function to run docker-compose commands
run_compose() {
    local cmd="$1"
    local args="$2"
    
    if [[ -n "$SERVICES" ]]; then
        docker-compose $COMPOSE_FILES $COMPOSE_PROFILE $cmd $SERVICES $args
    else
        docker-compose $COMPOSE_FILES $COMPOSE_PROFILE $cmd $args
    fi
}

# Main script logic
case $ACTION in
    up)
        print_header "Starting Occupancy ML API ($ENVIRONMENT)"
        print_status "Building images..."
        run_compose "build"
        print_status "Starting services..."
        run_compose "up" "-d"
        print_status "Services started successfully!"
        print_status "API available at: http://localhost:8000"
        print_status "API docs at: http://localhost:8000/docs"
        print_status "Health check: http://localhost:8000/health"
        ;;
    
    down)
        print_header "Stopping Occupancy ML API ($ENVIRONMENT)"
        run_compose "down"
        print_status "Services stopped successfully!"
        ;;
    
    restart)
        print_header "Restarting Occupancy ML API ($ENVIRONMENT)"
        run_compose "restart"
        print_status "Services restarted successfully!"
        ;;
    
    build)
        print_header "Building Occupancy ML API ($ENVIRONMENT)"
        run_compose "build" "--no-cache"
        print_status "Build completed successfully!"
        ;;
    
    logs)
        print_header "Showing Logs ($ENVIRONMENT)"
        run_compose "logs" "-f"
        ;;
    
    status)
        print_header "Service Status ($ENVIRONMENT)"
        run_compose "ps"
        ;;
    
    clean)
        print_header "Cleaning Up ($ENVIRONMENT)"
        print_warning "This will remove all containers, images, and volumes!"
        read -p "Are you sure? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            run_compose "down" "-v --remove-orphans"
            docker system prune -f
            print_status "Cleanup completed!"
        else
            print_status "Cleanup cancelled."
        fi
        ;;
    
    test)
        print_header "Running Tests ($ENVIRONMENT)"
        print_status "Starting test environment..."
        docker-compose -f docker-compose.yaml -f docker-compose.override.yml --profile testing up -d
        print_status "Waiting for services to be ready..."
        sleep 10
        print_status "Running tests..."
        docker-compose -f docker-compose.yaml -f docker-compose.override.yml exec occupancy-api python -m pytest test_model_api.py -v
        print_status "Tests completed!"
        ;;
    
    *)
        print_error "Unknown action: $ACTION"
        show_usage
        exit 1
        ;;
esac
