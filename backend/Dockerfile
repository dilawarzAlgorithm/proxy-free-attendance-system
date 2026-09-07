# Use the official lightweight Python 3.9 image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Prevent Python from writing pyc files and enforce unbuffered stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (required for some Python packages like psycopg2 or bcrypt)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose the port (Render sets the PORT environment variable dynamically)
EXPOSE 8000

# Start the FastAPI app using Uvicorn. 
# We use $PORT so Render can dynamically assign the port at runtime, falling back to 8000 locally.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]