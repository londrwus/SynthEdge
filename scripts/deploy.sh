#!/bin/bash
# =============================================================
# SynthEdge Deployment Script
# Run on the production server: bash scripts/deploy.sh
# =============================================================

set -euo pipefail

PROJECT_DIR="/opt/synthedge"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# -----------------------------------------------------------
# 1. Navigate to project
# -----------------------------------------------------------
if [ ! -d "$PROJECT_DIR" ]; then
    error "Project directory $PROJECT_DIR does not exist."
    error "Run scripts/server-setup.sh first."
    exit 1
fi

cd "$PROJECT_DIR"

# -----------------------------------------------------------
# 2. Check env file
# -----------------------------------------------------------
if [ ! -f "$ENV_FILE" ]; then
    error "Missing $ENV_FILE. Copy .env.prod.example and fill in values."
    exit 1
fi

# -----------------------------------------------------------
# 3. Pull latest code
# -----------------------------------------------------------
log "Pulling latest code from origin/main..."
git pull origin main

# -----------------------------------------------------------
# 4. Build images
# -----------------------------------------------------------
log "Building Docker images..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache

# -----------------------------------------------------------
# 5. Stop old containers and start new ones
# -----------------------------------------------------------
log "Restarting services..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# -----------------------------------------------------------
# 6. Wait for services to be healthy
# -----------------------------------------------------------
log "Waiting for services to become healthy..."

MAX_WAIT=120
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    UNHEALTHY=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | \
        python3 -c "
import sys, json
unhealthy = []
for line in sys.stdin:
    try:
        svc = json.loads(line)
        status = svc.get('Health', svc.get('Status', ''))
        if 'healthy' not in status.lower() and 'running' not in status.lower():
            unhealthy.append(svc.get('Service', svc.get('Name', 'unknown')))
    except json.JSONDecodeError:
        pass
print(len(unhealthy))
" 2>/dev/null || echo "0")

    if [ "$UNHEALTHY" = "0" ]; then
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    log "Still waiting... (${ELAPSED}s / ${MAX_WAIT}s)"
done

# -----------------------------------------------------------
# 7. Health checks
# -----------------------------------------------------------
log "Running health checks..."

echo ""
# Backend health
if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    log "Backend:  ${GREEN}HEALTHY${NC}"
else
    warn "Backend:  not responding on port 8000 (may still be starting)"
fi

# Frontend health
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    log "Frontend: ${GREEN}HEALTHY${NC}"
else
    warn "Frontend: not responding on port 3000 (may still be starting)"
fi

# Nginx health
if curl -sf http://localhost/health > /dev/null 2>&1; then
    log "Nginx:    ${GREEN}HEALTHY${NC}"
else
    warn "Nginx:    not responding on port 80"
fi

echo ""

# -----------------------------------------------------------
# 8. Show container status
# -----------------------------------------------------------
log "Container status:"
docker compose -f "$COMPOSE_FILE" ps

echo ""

# -----------------------------------------------------------
# 9. Show recent logs
# -----------------------------------------------------------
log "Recent logs (last 20 lines per service):"
echo ""
docker compose -f "$COMPOSE_FILE" logs --tail=20

echo ""
log "Deployment complete!"
log "Frontend: https://synthedge.xyz"
log "API:      https://api.synthedge.xyz"
echo ""
log "To tail logs:  docker compose -f $COMPOSE_FILE logs -f"
log "To restart:    docker compose -f $COMPOSE_FILE restart <service>"
