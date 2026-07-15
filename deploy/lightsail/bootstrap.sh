#!/usr/bin/env bash
# One-time Lightsail instance setup for the ABS Challenge backend.
# Run on a fresh Ubuntu 22.04/24.04 Lightsail instance as a user with sudo.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/ABS_Challenge/main/deploy/lightsail/bootstrap.sh | bash -s -- \
#     --repo git@github.com:YOUR_ORG/ABS_Challenge.git
#
# Or copy this script to the server and run locally after cloning the repo.
#
# This script uses bash-only syntax ([[ ]]). If invoked via `sh script.sh`
# (Ubuntu's /bin/sh is dash, which doesn't support [[ ]]), re-exec under bash.
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi

set -euo pipefail

REPO_URL=""
APP_DIR="/opt/abs-challenge"
BRANCH="master"

usage() {
  echo "Usage: $0 --repo <git-url> [--branch master] [--app-dir /opt/abs-challenge]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) REPO_URL="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --app-dir) APP_DIR="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ -z "$REPO_URL" ]]; then
  echo "Error: --repo is required"
  usage
fi

echo "==> Updating packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

echo "==> Installing git, curl, build tools"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl ca-certificates build-essential

echo "==> Installing Node.js 20"
NODE_MAJOR="$(node -v 2>/dev/null | cut -c2- | cut -d. -f1)"
if ! command -v node >/dev/null || [ "${NODE_MAJOR:-0}" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs
fi
node -v
npm -v

echo "==> Adding 2G swap (helps npm ci + tsc on 2GB instances)"
if ! swapon --show | grep -q '/swapfile'; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Installing Caddy"
if ! command -v caddy >/dev/null; then
  sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy
fi

echo "==> Cloning application to ${APP_DIR}"
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$(whoami):$(whoami)" "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "    Repo already exists at ${APP_DIR} — skipping clone"
fi

echo "==> Installing systemd unit"
sudo cp "$APP_DIR/deploy/lightsail/abs-backend.service" /etc/systemd/system/abs-backend.service
sudo systemctl daemon-reload
sudo systemctl enable abs-backend

echo ""
echo "Bootstrap complete. Next steps:"
echo "  1. Create ${APP_DIR}/backend/.env (see docs/DEPLOYMENT_LIGHTSAIL.md)"
echo "  2. Configure /etc/caddy/Caddyfile from deploy/lightsail/Caddyfile.example"
echo "  3. sudo systemctl reload caddy"
echo "  4. cd ${APP_DIR} && npm ci && npm run backend:build"
echo "  5. npx prisma migrate deploy --schema=backend/prisma/schema.prisma"
echo "  6. sudo systemctl start abs-backend"
echo "  7. Add GitHub Actions secrets and push to ${BRANCH} for auto-deploy"
