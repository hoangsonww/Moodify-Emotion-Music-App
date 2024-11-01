# Use a lightweight Python image as the base
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements.txt file if available
COPY requirements.txt /app

# Install dependencies
RUN if [ -f "requirements.txt" ]; then pip install --no-cache-dir -r requirements.txt; fi

# Copy the rest of the data_analytics directory into the container
COPY . /app

# Create a directory for visualizations output
RUN mkdir -p /app/visualizations

# Expose the port if there’s any web-based visualization, if needed (e.g., 8080)
# EXPOSE 8080

# Command to run the main script
CMD ["python", "main.py"]
