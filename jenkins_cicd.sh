#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to print stages
function print_stage() {
    echo -e "${GREEN}--- $1 ---${NC}"
}

# Stage 1: Install Dependencies
print_stage "Stage 1: Install Dependencies"
if npm install; then
    echo "Dependencies installed successfully."
else
    echo "Failed to install dependencies."
    exit 1
fi

# Stage 2: Build
print_stage "Stage 2: Build"
if npm run build; then
    echo "Build completed successfully."
else
    echo "Build failed."
    exit 1
fi

echo -e "${GREEN}Pipeline completed successfully.${NC}"
