# Use an official image as a base
FROM mcr.microsoft.com/devcontainers/universal:2

# Install additional dependencies
RUN apt-get update && \
    apt-get install -y \
    python3-pip \
    mongodb-clients \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (if needed)
WORKDIR /workspace
COPY requirements.txt /workspace/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Expose ports for development
EXPOSE 3000 8000 5000 27017

CMD ["sleep", "infinity"]
