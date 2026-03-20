#!/bin/bash
set -euo pipefail

# =====================================================
# PathFinder Deploy Script
# Run from /opt/pathfinder/app (the repo root)
# =====================================================

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="/opt/pathfinder/.env"

echo "=== PathFinder Deploy ==="
echo "App directory: ${APP_DIR}"

# Check .env exists
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: ${ENV_FILE} not found. Run setup-vps.sh first."
  exit 1
fi

# Check FRONTEND_URL is set
source "$ENV_FILE"
if [ "$FRONTEND_URL" = "https://your-app.vercel.app" ]; then
  echo "ERROR: FRONTEND_URL is still the placeholder. Edit ${ENV_FILE} first."
  exit 1
fi

cd "$APP_DIR"

# Pull latest code
echo "[1/4] Pulling latest code..."
git pull origin develop

# Copy env file
echo "[2/4] Loading environment..."
cp "$ENV_FILE" .env

# Build and start containers
echo "[3/4] Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# Wait for health check
echo "[4/4] Waiting for services..."
sleep 5

# Check if backend is healthy
if curl -sf http://localhost:4000/api/universities > /dev/null 2>&1; then
  echo ""
  echo "=== Deploy successful! ==="
  echo "Backend running on http://localhost:4000"
  echo "Caddy will proxy https://your-domain -> localhost:4000"
else
  echo ""
  echo "WARNING: Backend may still be starting. Check with:"
  echo "  docker compose -f docker-compose.prod.yml logs -f backend"
fi
