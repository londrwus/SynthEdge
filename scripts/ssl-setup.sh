#!/bin/bash
# =============================================================
# SynthEdge SSL Setup — Let's Encrypt via Certbot
# Run on the production server: sudo bash scripts/ssl-setup.sh
# =============================================================

set -euo pipefail

DOMAIN="synthedge.xyz"
API_DOMAIN="api.synthedge.xyz"
EMAIL="${SSL_EMAIL:-admin@synthedge.xyz}"
PROJECT_DIR="/opt/synthedge"
COMPOSE_FILE="docker-compose.prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[SSL]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# -----------------------------------------------------------
# Must run as root
# -----------------------------------------------------------
if [ "$EUID" -ne 0 ]; then
    error "This script must be run as root (use sudo)."
    exit 1
fi

# -----------------------------------------------------------
# 1. Install certbot if not present
# -----------------------------------------------------------
if ! command -v certbot &> /dev/null; then
    log "Installing certbot..."
    apt-get update
    apt-get install -y certbot
    log "Certbot installed."
else
    log "Certbot already installed."
fi

# -----------------------------------------------------------
# 2. Stop nginx to free port 80 for standalone mode
# -----------------------------------------------------------
log "Stopping nginx container to free port 80..."
cd "$PROJECT_DIR"
docker compose -f "$COMPOSE_FILE" stop nginx 2>/dev/null || true

# Also stop any system nginx
systemctl stop nginx 2>/dev/null || true

# -----------------------------------------------------------
# 3. Obtain certificates
# -----------------------------------------------------------
log "Requesting SSL certificate for $DOMAIN and $API_DOMAIN..."

certbot certonly \
    --standalone \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    -d "$API_DOMAIN"

if [ $? -eq 0 ]; then
    log "SSL certificate obtained successfully!"
    log "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
else
    error "Failed to obtain SSL certificate."
    error "Make sure DNS A records point to this server:"
    error "  $DOMAIN       -> $(curl -s ifconfig.me)"
    error "  $API_DOMAIN   -> $(curl -s ifconfig.me)"
    exit 1
fi

# -----------------------------------------------------------
# 4. Verify certificate files exist
# -----------------------------------------------------------
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    log "Certificate files verified:"
    log "  fullchain: $CERT_DIR/fullchain.pem"
    log "  privkey:   $CERT_DIR/privkey.pem"
else
    error "Certificate files not found in $CERT_DIR"
    exit 1
fi

# -----------------------------------------------------------
# 5. Set up auto-renewal with cron
# -----------------------------------------------------------
log "Setting up auto-renewal..."

CRON_CMD="0 3 * * * certbot renew --quiet --deploy-hook 'docker compose -f $PROJECT_DIR/$COMPOSE_FILE restart nginx'"

# Remove existing certbot cron entries and add new one
(crontab -l 2>/dev/null | grep -v "certbot renew" || true; echo "$CRON_CMD") | crontab -

log "Auto-renewal cron job configured (runs daily at 3 AM)."

# -----------------------------------------------------------
# 6. Test renewal (dry run)
# -----------------------------------------------------------
log "Testing renewal (dry run)..."
certbot renew --dry-run

if [ $? -eq 0 ]; then
    log "Renewal dry-run passed."
else
    warn "Renewal dry-run failed. Check certbot configuration."
fi

# -----------------------------------------------------------
# 7. Update nginx config for SSL mode
# -----------------------------------------------------------
log "Make sure nginx/synthedge.conf has the SSL server blocks uncommented (default)."
log "The HTTP-only blocks should be commented out."

# -----------------------------------------------------------
# 8. Restart nginx
# -----------------------------------------------------------
log "Starting nginx with SSL..."
cd "$PROJECT_DIR"
docker compose -f "$COMPOSE_FILE" start nginx

echo ""
log "SSL setup complete!"
log ""
log "Verify by visiting:"
log "  https://$DOMAIN"
log "  https://$API_DOMAIN"
echo ""
log "Certificate will auto-renew via cron."
log "To manually renew: sudo certbot renew"
