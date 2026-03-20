#!/bin/bash
# start.sh - Shutdown and Restart Backend and Frontend Servers

if [ "$1" == "stop" ]; then
    STOP_ONLY=true
    PORT=${2:-8000}
elif [[ "$1" =~ ^[0-9]+$ ]]; then
    PORT=$1
    STOP_ONLY=false
else
    PORT=${1:-8000}
    STOP_ONLY=false
fi
FRONTEND_PORT=5173

echo "=== Server Manager ==="
echo "Backend Port: $PORT"
echo "Frontend Port: $FRONTEND_PORT"

# 1. Kill absolute process on backend port
echo "Searching for active processes on port $PORT..."
PID=$(lsof -t -i:$PORT)

if [ -n "$PID" ]; then
    echo "🚨 Found process $PID running on port $PORT. Killing it..."
    kill -9 $PID
    if [ $? -eq 0 ]; then
        echo "✅ Killed process safely. Waiting for port release..."
        sleep 2
    else
        echo "❌ Failed to kill process. Check permissions."
    fi
else
    echo "💡 No active process found on port $PORT."
fi

# 2. Kill absolute process on frontend port
echo "Searching for active processes on port $FRONTEND_PORT..."
FRONTEND_PID=$(lsof -t -i:$FRONTEND_PORT)

if [ -n "$FRONTEND_PID" ]; then
    echo "🚨 Found process $FRONTEND_PID running on port $FRONTEND_PORT. Killing it..."
    kill -9 $FRONTEND_PID
    if [ $? -eq 0 ]; then
        echo "✅ Killed process safely. Waiting for port release..."
        sleep 2
    else
        echo "❌ Failed to kill process. Check permissions."
    fi
else
    echo "💡 No active process found on port $FRONTEND_PORT."
fi

if [ "$STOP_ONLY" = true ]; then
    echo "🛑 Stop command received. All related servers have been stopped."
    exit 0
fi

# 3. Add root to path for standard model references
export PYTHONPATH=$PYTHONPATH:.

# 4. Startup Backend Server
echo "🚀 Starting FastAPI on port $PORT..."
uv run uvicorn backend.svc.main:app --host 0.0.0.0 --port "$PORT" --reload &

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready on port $PORT..."
while ! nc -z localhost $PORT; do
    sleep 1
done
echo "✅ Backend is up!"

# 5. Startup Frontend Server
echo "🚀 Starting Frontend on port $FRONTEND_PORT..."
cd frontend && npm run dev -- --port $FRONTEND_PORT --host 0.0.0.0 &

# Wait for all background processes to keep the script running
wait
