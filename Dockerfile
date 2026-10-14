# ==========================================
# Stage 1: Build the React PWA Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy frontend dependency manifests
COPY frontend/package*.json ./
RUN npm ci || npm install

# Copy frontend source code and build production assets
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Build the FastAPI Backend & Embed Frontend
# ==========================================
FROM python:3.9-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ .

# Copy compiled frontend build into backend static directory
COPY --from=frontend-builder /frontend/dist ./static

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
