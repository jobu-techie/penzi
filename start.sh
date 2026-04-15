#!/bin/bash

echo "Starting Penzi system..."

# Activate virtual environment
source venv/bin/activate

# Kill any process using port 5000
fuser -k 5000/tcp 2>/dev/null

# Start Flask app in background
echo "Starting Flask app..."
python run.py &

# Give Flask time to start
sleep 2

# Start SMS worker
echo "Starting SMS worker..."
python -m app.services.sms_worker
