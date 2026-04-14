#!/bin/bash
set -e

echo "🏥 Starting Waitwell..."

# Kill any existing instances
pkill -f "node.*waitwell" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start backend
cd "$(dirname "$0")/backend"
node --experimental-sqlite src/index.js &
BACKEND_PID=$!
echo "✅ Backend started (pid $BACKEND_PID) on http://localhost:3001"

# Start frontend
cd "$(dirname "$0")/frontend"
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started (pid $FRONTEND_PID) on http://localhost:5173"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Patient App:  http://localhost:5173"
echo "  Practice PIN: 1234"
echo "  Dashboard:    http://localhost:5173/practice"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop both servers"

wait
