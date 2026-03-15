# SynthEdge Deployment Guide

**Server:** YOUR_SERVER_IP
**Domain:** synthedge.xyz
**OS:** Ubuntu 24.04

---

## Pre-requisites

- DNS A records pointing to YOUR_SERVER_IP:
  - `synthedge.xyz` → YOUR_SERVER_IP
  - `api.synthedge.xyz` → YOUR_SERVER_IP
- SSH access: `ssh root@YOUR_SERVER_IP`

---

## Step 1: Push Code to GitHub (from Windows)

```bash
cd C:\Users\Carl\Documents\SynthEdge
git add -A
git commit -m "SynthEdge v1.0 - hackathon submission"
git remote add origin https://github.com/YOUR_USERNAME/SynthEdge.git
git push -u origin main
```

---

## Step 2: SSH into Server & Stop Existing Services

```bash
ssh root@YOUR_SERVER_IP

# Stop ALL existing docker containers (they're using ports 80, 443, 3000)
docker stop $(docker ps -aq) 2>/dev/null
docker rm $(docker ps -aq) 2>/dev/null

# Verify ports are free
ss -tlnp | grep -E ':80|:443|:3000|:8000'
# Should show nothing
```

---

## Step 3: Install Docker (if needed)

```bash
# Check if Docker exists
docker --version && docker compose version

# If not installed:
apt update && apt install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

---

## Step 4: Clone & Configure

```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/SynthEdge.git synthedge
cd /opt/synthedge

# Create production environment
cp .env.prod .env.prod.bak
nano .env.prod
```

**Set these values in `.env.prod`:**
```env
POSTGRES_PASSWORD=<run: python3 -c "import secrets; print(secrets.token_hex(16))">
REDIS_PASSWORD=<run: python3 -c "import secrets; print(secrets.token_hex(16))">
SECRET_KEY=<run: python3 -c "import secrets; print(secrets.token_hex(32))">
SYNTH_API_KEY=your_synth_api_key_here
CORS_ORIGINS=https://synthedge.xyz
SYNTH_POLL_INTERVAL_SECONDS=300
SYNTH_CACHE_TTL_SECONDS=600
```

Also update the `POSTGRES_URL` and `REDIS_URL` with the same passwords:
```env
POSTGRES_URL=postgresql+asyncpg://synthedge:<YOUR_PG_PASSWORD>@postgres:5432/synthedge
REDIS_URL=redis://:<YOUR_REDIS_PASSWORD>@redis:6379/0
```

---

## Step 5: First Deploy (HTTP-only, before SSL)

Edit nginx config to use HTTP mode first:
```bash
nano /opt/synthedge/nginx/synthedge.conf
```

**Uncomment the HTTP-only blocks** (lines 38-82) and **comment out the SSL blocks** (lines 84-204). Or use this quick sed:
```bash
cd /opt/synthedge

# Switch to HTTP-only mode
sed -i '38,82s/^# //' nginx/synthedge.conf
sed -i '89,204s/^[^#]/# &/' nginx/synthedge.conf
```

Build and start:
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod build
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Wait ~60 seconds, then verify:
```bash
docker compose -f docker-compose.prod.yml ps
curl http://localhost/api/health
curl http://localhost
```

If working, test from browser: `http://synthedge.xyz`

---

## Step 6: SSL Setup

```bash
# Install certbot
apt install -y certbot

# Stop nginx temporarily to free port 80
docker compose -f docker-compose.prod.yml stop nginx

# Get SSL certificates
certbot certonly --standalone \
  --non-interactive --agree-tos \
  --email your@email.com \
  -d synthedge.xyz \
  -d www.synthedge.xyz \
  -d api.synthedge.xyz

# Switch nginx back to SSL mode (restore original config)
cd /opt/synthedge
git checkout nginx/synthedge.conf

# Restart nginx with SSL
docker compose -f docker-compose.prod.yml start nginx
```

Verify: `https://synthedge.xyz`

Setup auto-renewal:
```bash
echo "0 3 * * * certbot renew --quiet --deploy-hook 'cd /opt/synthedge && docker compose -f docker-compose.prod.yml restart nginx'" | crontab -
```

---

## Step 7: Verify Everything

```bash
# All containers healthy
docker compose -f docker-compose.prod.yml ps

# Backend API
curl https://api.synthedge.xyz/api/health

# Scanner data
curl https://api.synthedge.xyz/api/analytics/scanner?horizon=24h

# Frontend
curl -I https://synthedge.xyz
```

---

## Updating (after code changes)

```bash
ssh root@YOUR_SERVER_IP
cd /opt/synthedge
git pull origin main
docker compose -f docker-compose.prod.yml --env-file .env.prod build --no-cache
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

## Useful Commands

```bash
# Logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f nginx

# Restart single service
docker compose -f docker-compose.prod.yml restart backend

# Force refresh Synth data (costs 18 credits)
curl -X POST https://api.synthedge.xyz/api/refresh

# Shell into backend container
docker compose -f docker-compose.prod.yml exec backend bash

# Check disk usage
docker system df
```

---

## Architecture

```
Internet → DNS → YOUR_SERVER_IP
                    │
            ┌───────┴───────┐
            │   Nginx :80   │ ← Docker container
            │   Nginx :443  │ ← SSL from Let's Encrypt
            └───┬───────┬───┘
                │       │
      ┌─────────┘       └─────────┐
      ▼                           ▼
 Frontend :3000              Backend :8000
 (Next.js standalone)        (FastAPI + uvicorn)
                                  │
                          ┌───────┴───────┐
                          ▼               ▼
                     Redis :6379    Postgres :5432
                     (cache)       (journal data)
```
