#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print stages
function print_stage() {
    echo -e "${GREEN}--- $1 ---${NC}"
}

# Function to display help message
function show_help() {
    echo "Usage: $0 [option]"
    echo "Options:"
    echo "  build        Build the Docker image for data analytics"
    echo "  start        Run the Docker container"
    echo "  stop         Stop the running container"
    echo "  logs         Show logs for the container"
    echo "  help         Display this help message"
}

# Set image and container names
IMAGE_NAME="data_analytics_image"
CONTAINER_NAME="data_analytics_container"

# Handle script arguments
case "$1" in
    build)
        print_stage "Building the Docker image"
        docker build -t $IMAGE_NAME .
        ;;
    start)
        print_stage "Starting the Docker container"
        docker run -d --name $CONTAINER_NAME $IMAGE_NAME
        ;;
    stop)
        print_stage "Stopping the Docker container"
        docker stop $CONTAINER_NAME
        docker rm $CONTAINER_NAME
        ;;
    logs)
        print_stage "Displaying logs for the Docker container"
        docker logs -f $CONTAINER_NAME
        ;;
    help)
        show_help
        ;;
    *)
        echo -e "${RED}Invalid option!${NC}"
        show_help
        ;;
esac
