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
    echo "  start          Start the frontend service"
    echo "  build          Build the frontend project"
    echo "  test           Run frontend tests"
    echo "  eject          Eject the frontend project (if using CRA)"
    echo "  frontend       Start only the frontend"
    echo "  backend        Start only the backend"
    echo "  dev            Run both backend and frontend concurrently"
    echo "  format         Format frontend files using Prettier"
    echo "  help           Display this help message"
}

# Handle script arguments
case "$1" in
    start)
        print_stage "Starting frontend service"
        cd frontend && npm start
        ;;
    build)
        print_stage "Building frontend project"
        cd frontend && npm run build
        ;;
    test)
        print_stage "Running frontend tests"
        cd frontend && npm test
        ;;
    eject)
        print_stage "Ejecting frontend project"
        cd frontend && npm run eject
        ;;
    frontend)
        print_stage "Starting frontend only"
        cd frontend && npm start
        ;;
    backend)
        print_stage "Starting backend only"
        cd backend && python manage.py runserver
        ;;
    dev)
        print_stage "Starting both backend and frontend concurrently"
        npm run dev
        ;;
    format)
        print_stage "Formatting frontend files"
        npm run format
        ;;
    help)
        show_help
        ;;
    *)
        echo -e "${RED}Invalid option!${NC}"
        show_help
        ;;
esac
