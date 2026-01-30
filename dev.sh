#!/bin/bash

# Define a cleanup function
cleanup() {
    echo "Shutting down..."
    # Kill all child processes (npm run dev)
    kill $(jobs -p) 2>/dev/null
    # Stop docker containers
    docker compose down
    exit
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT

echo "Starting PlantLab..."

# Start Docker Compose in the background
docker compose up &
DOCKER_PID=$!

# Wait a moment for services to start initializing
sleep 2

# Start Frontend
cd frontend
npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $DOCKER_PID $FRONTEND_PID
