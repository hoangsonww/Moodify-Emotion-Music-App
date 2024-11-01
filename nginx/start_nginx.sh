#!/bin/bash

# Define the docker-compose file location
COMPOSE_FILE="docker-compose.yml"

# Display help message
function show_help() {
    echo "Usage: $0 [option]"
    echo "Options:"
    echo "  build    Build the Nginx Docker image"
    echo "  start    Start the Nginx container"
    echo "  stop     Stop the Nginx container"
    echo "  restart  Restart the Nginx container"
    echo "  logs     Show logs of the Nginx container"
    echo "  clean    Stop and remove the container"
    echo "  help     Display this help message"
}

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    echo "Error: $COMPOSE_FILE not found!"
    exit 1
fi

# Handle script arguments
case "$1" in
    build)
        echo "Building the Nginx Docker image..."
        docker-compose -f $COMPOSE_FILE build
        ;;
    start)
        echo "Starting the Nginx container..."
        docker-compose -f $COMPOSE_FILE up -d
        ;;
    stop)
        echo "Stopping the Nginx container..."
        docker-compose -f $COMPOSE_FILE down
        ;;
    restart)
        echo "Restarting the Nginx container..."
        docker-compose -f $COMPOSE_FILE down
        docker-compose -f $COMPOSE_FILE up -d
        ;;
    logs)
        echo "Displaying logs of the Nginx container..."
        docker-compose -f $COMPOSE_FILE logs -f
        ;;
    clean)
        echo "Cleaning up: stopping and removing the container..."
        docker-compose -f $COMPOSE_FILE down -v
        ;;
    help)
        show_help
        ;;
    *)
        echo "Invalid option!"
        show_help
        ;;
esac
