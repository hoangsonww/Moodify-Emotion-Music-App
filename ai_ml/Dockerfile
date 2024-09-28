# Use Python 3.10
FROM python:3.10-slim

# Set the working directory
WORKDIR /app

# Copy the requirements.txt file from the root directory
COPY requirements.txt ./requirements.txt

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the ai_ml directory into the container
COPY ai_ml/ .

# Expose the port that the API will run on
EXPOSE 5000

# Run the Flask API
CMD ["python", "src/api/emotion_api.py"]
