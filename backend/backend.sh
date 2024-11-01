#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print stages
function print_stage() {
    echo -e "${GREEN}--- $1 ---${NC}"
}

print_stage "Starting Django Backend for Moodify App"

# Step 1: Check if Python and Django are installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python3 is not installed. Please install it first.${NC}"
    exit 1
fi

if ! python3 -c "import django" &> /dev/null; then
    echo -e "${RED}Django is not installed. Installing Django...${NC}"
    pip install django
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install Django. Please check your Python and pip setup.${NC}"
        exit 1
    fi
fi

# Step 2: Set up the environment variables and start the server
export DJANGO_SETTINGS_MODULE="backend.settings"

# Adding the project root and 'ai_ml' to PYTHONPATH
PROJECT_ROOT=$(dirname "$(dirname "$(realpath "$0")")")
export PYTHONPATH="$PROJECT_ROOT:$PROJECT_ROOT/ai_ml:$PYTHONPATH"

# Step 3: Run Django's development server
print_stage "Running Django Development Server on http://127.0.0.1:8000"
python3 "$PROJECT_ROOT/backend/manage.py" runserver 8000

# Check if server started successfully
if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start the Django server.${NC}"
    exit 1
else
    echo -e "${GREEN}Django server started successfully.${NC}"
fi
