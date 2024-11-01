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
    echo "  start          Start the frontend development server"
    echo "  build          Build the frontend for production"
    echo "  test           Run frontend tests"
    echo "  format         Format frontend code using Prettier"
    echo "  help           Display this help message"
}

# Check for necessary tools (node and npm)
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install it first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}NPM is not installed. Please install it first.${NC}"
    exit 1
fi

# Handle script arguments
case "$1" in
    start)
        print_stage "Starting frontend development server"
        npm start
        ;;
    build)
        print_stage "Building frontend for production"
        npm run build
        ;;
    test)
        print_stage "Running frontend tests"
        npm test
        ;;
    format)
        print_stage "Formatting frontend code using Prettier"
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
