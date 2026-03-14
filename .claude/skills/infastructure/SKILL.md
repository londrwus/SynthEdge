# SKILL: Infrastructure — Ubuntu 24.04 Production

## Overview
Self-hosted on Ubuntu 24.04. Domain pointed to server IP. SSL via Let's Encrypt. Everything runs in Docker.

## Prerequisites on Server

```bash
# Update
sudo apt update && sudo apt upgrade -y

# Docker (official repo)
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Certbot (SSL)
sudo apt install -y certbot

# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## DNS Setup
Point your domain to server IP:
```
A   synthedge.app        → YOUR_SERVER_IP
A   api.synthedge.app    → YOUR_SERVER_IP
```
Wait for DNS propagation (usually 5-15 min with Cloudflare).

## Project Layout on Server

```
/opt/synthedge/
├── docker-compose.prod.yml
├── .env.prod
├── nginx/
│   └── synthedge.conf
├── ssl/                        # Certbot will populate
├── backend/
│   └── Dockerfile
├── frontend/
│   └── Dockerfile
└── init.sql                    # PostgreSQL init
```

## docker-compose.prod.yml

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    env_file: .env.prod
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal
    expose:
      - "8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: https://api.${DOMAIN}
    restart: always
    networks:
      - internal
    expose:
      - "3000"

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/synthedge.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/letsencrypt
    depends_on:
      - backend
      - frontend
    networks:
      - internal

volumes:
  pgdata:

networks:
  internal:
    driver: bridge
```

## Backend Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential && rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e "."

COPY . .

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

## Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

**IMPORTANT:** In `next.config.ts`:
```typescript
const nextConfig = {
  output: 'standalone',  // Required for Docker
}
```

## Nginx Config

```nginx
# /opt/synthedge/nginx/synthedge.conf

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name YOURDOMAIN.com api.YOURDOMAIN.com;
    
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}

# Frontend
server {
    listen 443 ssl http2;
    server_name YOURDOMAIN.com;

    ssl_certificate     /etc/letsencrypt/live/YOURDOMAIN.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOURDOMAIN.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.YOURDOMAIN.com;

    ssl_certificate     /etc/letsencrypt/live/YOURDOMAIN.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/YOURDOMAIN.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # CORS headers (backup, FastAPI also handles)
    add_header Access-Control-Allow-Origin "https://YOURDOMAIN.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Synth-Api-Key, X-HL-Address" always;

    location / {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## SSL Setup (Let's Encrypt)

```bash
# BEFORE starting nginx container, get certs:
# (stop nginx first if running)
sudo certbot certonly --standalone \
  -d YOURDOMAIN.com \
  -d api.YOURDOMAIN.com \
  --agree-tos \
  --email your@email.com

# Certs land in /etc/letsencrypt/live/YOURDOMAIN.com/
# Mount that into docker:
# volumes:
#   - /etc/letsencrypt:/etc/letsencrypt:ro
```

**Hackathon shortcut:** If SSL is blocking you, just use HTTP and port 80. Judges won't dock points for no SSL on a hackathon demo. Replace the nginx config with a simpler one:

```nginx
# HTTP-only fallback (hackathon mode)
server {
    listen 80;
    server_name YOURDOMAIN.com;
    location / {
        proxy_pass http://frontend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
server {
    listen 80;
    server_name api.YOURDOMAIN.com;
    location / {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Deployment Script

```bash
#!/bin/bash
# deploy.sh — run on server

set -e

cd /opt/synthedge

# Pull latest code
git pull origin main

# Build and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Check health
sleep 5
curl -f http://localhost:8000/api/health || echo "Backend not ready yet"
curl -f http://localhost:3000 || echo "Frontend not ready yet"

echo "Deployed!"
```

## Quick Deploy from Local Machine

```bash
# From your dev machine (Windows 11)
# Push code to GitHub, then SSH into server:

ssh user@YOUR_SERVER_IP "cd /opt/synthedge && git pull && docker compose -f docker-compose.prod.yml up -d --build"
```

## Windows 11 Local Dev

On Windows, use Docker Desktop or WSL2:

```powershell
# WSL2 (recommended)
wsl --install -d Ubuntu-24.04

# Inside WSL:
cd /mnt/c/Users/YOU/projects/synthedge
docker compose up -d          # Start Postgres + Redis
cd backend && pip install -e "." && uvicorn app.main:app --reload
cd frontend && npm install && npm run dev
```

Or just use Docker Desktop with the `docker-compose.yml` (dev version).

## .env.prod (Production)

```env
# Domain
DOMAIN=synthedge.app

# PostgreSQL
POSTGRES_USER=synthedge
POSTGRES_PASSWORD=GENERATE_STRONG_PASSWORD_HERE
POSTGRES_DB=synthedge
POSTGRES_URL=postgresql+asyncpg://synthedge:GENERATE_STRONG_PASSWORD_HERE@postgres:5432/synthedge

# Redis
REDIS_PASSWORD=GENERATE_STRONG_PASSWORD_HERE
REDIS_URL=redis://:GENERATE_STRONG_PASSWORD_HERE@redis:6379/0

# Backend
SECRET_KEY=GENERATE_32_BYTE_RANDOM_HERE
CORS_ORIGINS=https://synthedge.app
LOG_LEVEL=info

# Synth (dev/fallback key for server-side polling)
SYNTH_API_KEY=your_synth_api_key
SYNTH_POLL_INTERVAL_SECONDS=60
SYNTH_CACHE_TTL_SECONDS=55
```

## Monitoring (Minimal for Hackathon)

```bash
# Check all containers running
docker compose -f docker-compose.prod.yml ps

# Tail logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# Restart a service
docker compose -f docker-compose.prod.yml restart backend
```

## Troubleshooting Checklist

| Problem | Fix |
|---------|-----|
| Nginx 502 | Backend not started yet. Check `docker logs backend` |
| CORS error | Check CORS_ORIGINS matches your domain exactly (with https://) |
| Can't connect to Postgres | Check container is healthy: `docker compose ps` |
| Synth API 401 | API key invalid or expired |
| Frontend blank | Check `NEXT_PUBLIC_API_URL` was set at BUILD TIME (not runtime) |
| SSL cert error | Cert path wrong in nginx config, or cert not generated yet |
| Port 80/443 blocked | Check `ufw status`, ensure ports are allowed |
