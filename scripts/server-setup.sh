#!/bin/bash
# =============================================================
# SynthEdge Initial Server Setup — Ubuntu 24.04
# Server: YOUR_SERVER_IP
# Run: sudo bash server-setup.sh
# =============================================================

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/YOUR_USERNAME/SynthEdge.git}"
PROJECT_DIR="/opt/synthedge"
DEPLOY_USER="${DEPLOY_USER:-$(logname 2>/dev/null || echo $SUDO_USER || echo $USER)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[SETUP]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# -----------------------------------------------------------
# Must run as root
# -----------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)."
    exit 1
fi

echo "========================================"
echo "  SynthEdge Server Setup"
echo "  Ubuntu 24.04 — YOUR_SERVER_IP"
echo "========================================"
echo ""

# -----------------------------------------------------------
# 1. System update
# -----------------------------------------------------------
log "Updating system packages..."
apt-get update
apt-get upgrade -y

# -----------------------------------------------------------
# 2. Install essential packages
# -----------------------------------------------------------
log "Installing essential packages..."
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    git \
    ufw \
    htop \
    unzip \
    python3 \
    python3-pip

# -----------------------------------------------------------
# 3. Install Docker (official repository)
# -----------------------------------------------------------
if command -v docker &> /dev/null; then
    log "Docker already installed: $(docker --version)"
else
    log "Installing Docker..."

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    log "Docker installed: $(docker --version)"
fi

# -----------------------------------------------------------
# 4. Add deploy user to docker group
# -----------------------------------------------------------
log "Adding $DEPLOY_USER to docker group..."
usermod -aG docker "$DEPLOY_USER"

# -----------------------------------------------------------
# 5. Configure firewall (ufw)
# -----------------------------------------------------------
log "Configuring firewall..."

ufw --force reset
ufw default deny incoming
ufw default allow outgoing

# SSH
ufw allow 22/tcp comment "SSH"

# HTTP / HTTPS
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

ufw --force enable

log "Firewall status:"
ufw status verbose

# -----------------------------------------------------------
# 6. Clone repository
# -----------------------------------------------------------
if [ -d "$PROJECT_DIR" ]; then
    warn "Project directory $PROJECT_DIR already exists. Pulling latest..."
    cd "$PROJECT_DIR"
    git pull origin main || warn "Git pull failed (may need auth setup)"
else
    log "Cloning repository to $PROJECT_DIR..."
    git clone "$REPO_URL" "$PROJECT_DIR"
fi

# Set ownership
chown -R "$DEPLOY_USER":"$DEPLOY_USER" "$PROJECT_DIR"

# -----------------------------------------------------------
# 7. Create .env.prod if it doesn't exist
# -----------------------------------------------------------
if [ ! -f "$PROJECT_DIR/.env.prod" ]; then
    log "Creating .env.prod from template..."
    if [ -f "$PROJECT_DIR/.env.prod" ]; then
        cp "$PROJECT_DIR/.env.prod" "$PROJECT_DIR/.env.prod"
    elif [ -f "$PROJECT_DIR/.env.example" ]; then
        cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env.prod"
    fi
    warn "IMPORTANT: Edit $PROJECT_DIR/.env.prod with production values!"
    warn "  - Generate strong passwords for POSTGRES_PASSWORD and REDIS_PASSWORD"
    warn "  - Generate a SECRET_KEY: python3 -c \"import secrets; print(secrets.token_hex(32))\""
    warn "  - Set your SYNTH_API_KEY"
else
    log ".env.prod already exists."
fi

# -----------------------------------------------------------
# 8. Create SSL directory
# -----------------------------------------------------------
mkdir -p /etc/letsencrypt

# -----------------------------------------------------------
# 9. Initial deploy (HTTP-only mode)
# -----------------------------------------------------------
log "Preparing for initial deploy in HTTP-only mode..."
warn "Before first deploy:"
warn "  1. Edit $PROJECT_DIR/.env.prod with real credentials"
warn "  2. Set up DNS: A records for synthedge.xyz and api.synthedge.xyz -> YOUR_SERVER_IP"
warn "  3. For HTTP-only mode: edit nginx/synthedge.conf to uncomment HTTP blocks and comment SSL blocks"
warn "  4. Run: cd $PROJECT_DIR && bash scripts/deploy.sh"
warn "  5. After DNS propagates, run: sudo bash scripts/ssl-setup.sh"
warn "  6. Switch nginx config back to SSL mode (uncomment SSL blocks, comment HTTP blocks)"
warn "  7. Run: docker compose -f docker-compose.prod.yml restart nginx"

echo ""
echo "========================================"
log "Server setup complete!"
echo "========================================"
echo ""
log "Next steps:"
echo "  1. Edit .env.prod:    nano $PROJECT_DIR/.env.prod"
echo "  2. Deploy (HTTP):     cd $PROJECT_DIR && bash scripts/deploy.sh"
echo "  3. Setup SSL:         sudo bash $PROJECT_DIR/scripts/ssl-setup.sh"
echo "  4. Enable HTTPS:      (SSL blocks are default in nginx config)"
echo ""
log "Generate passwords with:"
echo "  python3 -c \"import secrets; print(secrets.token_hex(32))\""
echo ""
