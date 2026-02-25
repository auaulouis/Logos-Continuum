#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/verbatim-parser "
FRONTEND_DIR="$ROOT_DIR/logos-web"

echo "🚀 Starting Verbatim Search Engine..."

if [ ! -d "$BACKEND_DIR" ]; then
	echo "❌ Backend directory not found: $BACKEND_DIR"
	exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
	echo "❌ Frontend directory not found: $FRONTEND_DIR"
	exit 1
fi

if [ ! -f "$BACKEND_DIR/.venv/bin/activate" ]; then
	echo "❌ Missing backend virtual environment at: $BACKEND_DIR/.venv"
	echo "   Run: cd \"$BACKEND_DIR\" && python3 -m venv .venv"
	exit 1
fi

cleanup() {
	echo "🛑 Shutting down..."
	[ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
	[ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup SIGINT SIGTERM EXIT

echo "🐍 Starting API on Port 5001..."
cd "$BACKEND_DIR"
source .venv/bin/activate
PORT=5001 python3 api.py &
BACKEND_PID=$!

echo "⚛️  Starting Next.js Frontend..."
cd "$FRONTEND_DIR"
if command -v yarn >/dev/null 2>&1; then
	yarn dev &
else
	npm run dev &
fi
FRONTEND_PID=$!

echo "✅ All systems go!"
echo "   Backend:  http://localhost:5001"
echo "   Frontend: http://localhost:3000"
echo "   Press Ctrl+C to stop both servers."

wait