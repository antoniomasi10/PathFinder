#!/bin/bash
set -euo pipefail

# =====================================================
# PathFinder VPS Setup Script — Hetzner Ubuntu 22.04+
# Run as root: bash setup-vps.sh
# =====================================================

echo "=== PathFinder VPS Setup ==="

# 1. Update system
echo "[1/7] Updating system..."
apt update && apt upgrade -y

# 2. Install Docker
echo "[2/7] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# 3. Install Docker Compose plugin
echo "[3/7] Installing Docker Compose..."
apt install -y docker-compose-plugin

# 4. Install Caddy (reverse proxy + auto HTTPS)
echo "[4/7] Installing Caddy..."
if ! command -v caddy &> /dev/null; then
  apt install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt update
  apt install -y caddy
fi

# 5. Create app directory
echo "[5/7] Creating app directory..."
mkdir -p /opt/pathfinder
cd /opt/pathfinder

# 6. Generate secrets
echo "[6/7] Generating secrets..."
if [ ! -f .env ]; then
  JWT_SECRET=$(openssl rand -hex 64)
  JWT_REFRESH_SECRET=$(openssl rand -hex 64)
  DB_PASSWORD=$(openssl rand -hex 32)

  cat > .env << EOF
# PathFinder Production Environment
# Generated on $(date -u +"%Y-%m-%d %H:%M:%S UTC")

# Database
POSTGRES_DB=pathfinder
POSTGRES_USER=pathfinder
POSTGRES_PASSWORD=${DB_PASSWORD}

# Backend
DATABASE_URL=postgresql://pathfinder:${DB_PASSWORD}@postgres:5432/pathfinder?schema=public
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# IMPORTANT: Set this to your Vercel frontend URL after deploying
FRONTEND_URL=https://your-app.vercel.app
EOF

  chmod 600 .env
  echo "  -> .env created with random secrets"
  echo ""
  echo "  ⚠️  IMPORTANT: Edit /opt/pathfinder/.env and set FRONTEND_URL to your Vercel URL"
  echo ""
else
  echo "  -> .env already exists, skipping"
fi

# 7. Configure firewall
echo "[7/7] Configuring firewall..."
if command -v ufw &> /dev/null; then
  ufw allow 22/tcp    # SSH
  ufw allow 80/tcp    # HTTP (Caddy redirect)
  ufw allow 443/tcp   # HTTPS (Caddy)
  ufw --force enable
  echo "  -> Firewall configured (22, 80, 443)"
fi

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "  1. Point your domain (e.g. api.pathfinder.it) to this server's IP"
echo "  2. Clone the repo: git clone https://github.com/antoniomasi10/PathFinder.git /opt/pathfinder/app"
echo "  3. Edit /opt/pathfinder/.env — set FRONTEND_URL"
echo "  4. Run: cd /opt/pathfinder/app && bash deploy/deploy.sh"
echo ""
