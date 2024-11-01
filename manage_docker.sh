#!/bin/bash

# Define the docker-compose file location
COMPOSE_FILE="docker-compose.yml"

# Display help message
function show_help() {
    echo "Usage: $0 [option]"
    echo "Options:"
    echo "  build         Build Docker images for all services"
    echo "  start         Start all services (AI/ML, backend, frontend, MongoDB)"
    echo "  stop          Stop all services"
    echo "  restart       Restart all services"
    echo "  logs          Show logs for all services"
    echo "  logs-ai_ml    Show logs for the AI/ML service"
    echo "  logs-backend  Show logs for the backend service"
    echo "  logs-frontend Show logs for the frontend service"
    echo "  logs-mongodb  Show logs for the MongoDB service"
    echo "  clean         Stop and remove all containers, networks, and volumes"
    echo "  help          Display this help message"
}

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: $COMPOSE_FILE not found!"
    exit 1
fi

# Handle script arguments
case "$1" in
    build)
        echo "Building Docker images for all services..."
        docker-compose -f $COMPOSE_FILE build
        ;;
    start)
        echo "Starting all services..."
        docker-compose -f $COMPOSE_FILE up -d
        ;;
    stop)
        echo "Stopping all services..."
        docker-compose -f $COMPOSE_FILE down
        ;;
    restart)
        echo "Restarting all services..."
        docker-compose -f $COMPOSE_FILE down
        docker-compose -f $COMPOSE_FILE up -d
        ;;
    logs)
        echo "Displaying logs for all services..."
        docker-compose -f $COMPOSE_FILE logs -f
        ;;
    logs-ai_ml)
        echo "Displaying logs for the AI/ML service..."
        docker-compose -f $COMPOSE_FILE logs -f ai_ml
        ;;
    logs-backend)
        echo "Displaying logs for the backend service..."
        docker-compose -f $COMPOSE_FILE logs -f backend
        ;;
    logs-frontend)
        echo "Displaying logs for the frontend service..."
        docker-compose -f $COMPOSE_FILE logs -f frontend
        ;;
    logs-mongodb)
        echo "Displaying logs for the MongoDB service..."
        docker-compose -f $COMPOSE_FILE logs -f mongodb
        ;;
    clean)
        echo "Cleaning up: stopping and removing all containers, networks, and volumes..."
        docker-compose -f $COMPOSE_FILE down -v --remove-orphans
        ;;
    help)
        show_help
        ;;
    *)
        echo "Invalid option!"
        show_help
        ;;
esac
