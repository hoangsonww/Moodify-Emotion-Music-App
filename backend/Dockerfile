# Moodify Django API image.
#
# Build context is the repository root (see docker-compose.yml / CI):
#   docker build -f backend/Dockerfile -t moodify-backend .
#
# There is no SQL database (MongoDB only), so no `migrate` step is needed.
FROM python:3.11-slim

WORKDIR /app

# Slim, ML-free dependency set (see backend/requirements.txt).
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Application code.
COPY backend/ .

# Collect static assets for drf-yasg (best effort -- WhiteNoise also serves
# them via finders at runtime).
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

CMD ["gunicorn", "backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
