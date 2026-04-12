#!/bin/bash
# Coin Catalog server setup for Vultr Ubuntu 22.04
# Run as root on first deploy

set -e

echo "=== Updating system ==="
apt-get update && apt-get upgrade -y

echo "=== Installing Docker ==="
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "=== Installing Docker Compose plugin ==="
apt-get install -y docker-compose-plugin

echo "=== Setting up firewall ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "=== Creating app directory ==="
mkdir -p /root/coin-catalog

echo "=== Done ==="
echo "Docker version: $(docker --version)"
echo "Compose version: $(docker compose version)"
echo ""
echo "Next steps:"
echo "  1. Clone the repo: cd /root && git clone https://github.com/mwestondean/coin-catalog.git"
echo "  2. Create .env: cp /root/coin-catalog/platform/.env.example /root/coin-catalog/platform/.env"
echo "  3. Edit .env with production secrets"
echo "  4. Deploy: cd /root/coin-catalog/platform && docker compose -f docker-compose.prod.yml build && docker compose -f docker-compose.prod.yml up -d"
