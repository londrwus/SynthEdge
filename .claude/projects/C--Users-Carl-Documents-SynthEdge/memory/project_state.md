---
name: Project State - Session 4 Completion
description: Complete project state after session 4 - 24 API routes, 10 frontend routes, 53 tests, production ready
type: project
---

## Architecture
- Backend: FastAPI (Python 3.12) with 24 REST endpoints, Redis cache, background Synth polling
- Frontend: Next.js 15 (TypeScript) with 10 routes, TradingView Charts, D3.js probability cone
- Infra: Docker Compose (Postgres 16 + Redis 7), production config for synthedge.xyz

## Key Technical Facts
- Synth API asset names: BTC, ETH, SOL, XAU, SPY, NVDA, TSLA, AAPL, GOOGL (NO X suffix)
- Equities DON'T support 1h horizon (400 error) — only 24h works for SPY, NVDA, TSLA, AAPL, GOOGL
- 1h works for: BTC, ETH, SOL, XAU only
- Poll interval: 5 minutes (configurable). Credits: ~144/hr
- Redis TTL: 10 minutes. Frontend polls every 15s from cache.
- Synth API key: stored in .env, never committed to git
- HL test wallet configured (details in .env, not committed)
- 53 pytest tests, all passing

## What's Built
- Dashboard, Screener, Asset Detail, Risk Monitor, Portfolio, FAQ, Settings (7 nav tabs, 10 routes)
- Probability cone with interactive crosshair (D3.js)
- TradingView Lightweight Charts v5 with P05/P50/P95 bands
- Kelly calculator with suggested levels from distribution
- Cross-asset vol analysis (crypto 6x equity vol)
- Distribution analysis (percentile returns, CI widths, skew)
- Options pricing (Synth Monte Carlo)
- Hyperliquid trading endpoints (market, limit, smart order with Synth SL/TP)
- Trade panel component
- Industrial terminal design (Pencil webapp-03-industrialtechnical_light)
- Production deployment (docker-compose.prod, nginx, SSL scripts)

## Remaining Work
- Visual polish: some data overlap, readability issues on small screens
- More equity-specific features from hackathon ideas PDF
- Demo video recording
- Actual deployment to synthedge.xyz
- MetaMask/web3 wallet integration for frontend HL trading
