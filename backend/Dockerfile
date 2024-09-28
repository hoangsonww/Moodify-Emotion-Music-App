# Use Python 3.10
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Install system dependencies for MongoDB and any other required packages
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements.txt file from the root directory one level up
COPY ../requirements.txt ./requirements.txt

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY . .

# Expose Django port
EXPOSE 8000

# Run migrations and start the Django server
CMD ["sh", "-c", "python manage.py migrate && python manage.py runserver 0.0.0.0:8000"]
