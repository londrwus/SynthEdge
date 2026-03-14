# CLAUDE.md — SynthEdge Development Guide

> **Read skills/HACKATHON_SPEED.md first.** We have 8 hours. Every decision = "Will judges see this?"

---

## Project Identity

**Name:** SynthEdge
**Tagline:** Predictive Intelligence Meets On-Chain Execution
**Category:** Synth Hackathon 2026 — Best Equities Application
**Deadline:** March 14, 2026 EOD

---

## What This Project Does

SynthEdge is a real-time trading terminal that:
1. Fetches probabilistic price forecasts from **Synth API** (9 assets × 2 horizons)
2. Derives actionable intelligence locally (vol, direction, VaR, regime, Kelly sizing)
3. Displays in a dark neon-green terminal UI with probability cones, heatmaps, scanners
4. Shows user's **Hyperliquid** positions enriched with Synth risk data (read-only)
5. Links to Hyperliquid for trade execution (deep link, not in-app signing)

**BYOK:** Users provide their own Synth API key + Hyperliquid public address.

---

## SIMPLIFIED STACK (Hackathon Version)

### What we USE
| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | **Next.js 15** (App Router) + TypeScript | SSR, fast setup |
| Styling | **Tailwind CSS v4** + **shadcn/ui** | Dark theme, rapid component dev |
| Charts | **TradingView Lightweight Charts** + **D3.js** | Price charts + custom probability viz |
| Client state | **Zustand** | Simple, no boilerplate |
| Server state | **TanStack Query v5** | Polling, caching, refetch |
| Animation | **Framer Motion** | Number transitions, panel animations |
| Design | **Pencil.dev** | AI design → React code, FULL design authority |
| Backend | **Python 3.12 + FastAPI** | Async, fast to write |
| HTTP client | **httpx** | Async Synth API calls |
| HL reads | **hyperliquid-python-sdk** | Official SDK for position data |
| Math | **NumPy + SciPy** | Distribution math (no Rust needed) |
| Cache | **Redis 7** | Synth response cache + derived metrics |
| Database | **PostgreSQL 16** | Journal, settings (minimal for hackathon) |
| Infra | **Docker Compose** | Local dev + production |
| Production | **Ubuntu 24.04** + Nginx + Let's Encrypt | Self-hosted |

### What we DO NOT USE (saves hours)
- ~~Rust / PyO3~~ → Python + NumPy is fine
- ~~Celery~~ → FastAPI lifespan background task
- ~~MongoDB~~ → Redis + PostgreSQL cover everything
- ~~Alembic~~ → Raw init.sql
- ~~WebSocket~~ → TanStack Query polling (simpler, fewer bugs)
- ~~Client-side HL signing~~ → Read-only portfolio + deep links to trade

---

## Synth API (CRITICAL)

### Efficiency Rules
1. **One primary endpoint:** `GET /insights/prediction-percentiles?asset={ASSET}&horizon={1h|24h}`
2. **Poll REST every 60s** per asset → cache in Redis (TTL=55s)
3. **Derive EVERYTHING locally** from percentiles — NO separate API calls for vol, direction, etc.
4. **Dedicated insight endpoints** only when user opens specific view, never on a loop
5. **One fetch → cache → all components read from cache**

### Assets (EXACT Synth API strings)
```
BTC, ETH, SOL, XAU, SPYX, NVDAX, TSLAX, AAPLX, GOOGLX
```

### Auth
```
Header: Authorization: Apikey {USER_KEY}
Base:   https://api.synthdata.co
```

### Response: 9 percentile levels per timestep
```
0.005, 0.05, 0.2, 0.35, 0.5 (median), 0.65, 0.8, 0.95, 0.995
```
24h = 289 timesteps (5min), 1h = 61 timesteps (1min).

### Quick Derivation Formulas
```python
# All from the last timestep of forecast_future.percentiles
implied_vol = ((p95 - p05) / price) / 3.29 * sqrt(8760 / hours)
direction   = "bullish" if p50 > price else "bearish"
skew        = ((p95 - p50) - (p50 - p05)) / (p95 - p05)
kurtosis    = (p995 - p005) / (p80 - p20)
```

---

## Hyperliquid (READ-ONLY)

```python
from hyperliquid.info import Info
from hyperliquid.utils import constants
info = Info(constants.MAINNET_API_URL, skip_ws=True)
state = info.user_state("0xADDRESS")
# → assetPositions[], marginSummary
```

No private keys. No signing. Read positions, show enriched data, link to HL for trades.

---

## Backend: FastAPI + Background Poller

```python
from contextlib import asynccontextmanager
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(synth_polling_loop())
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)
```

### Redis Keys
```
synth:{asset}:{horizon}     → Raw percentiles JSON, TTL=55s
derived:{asset}:{horizon}   → Derived metrics JSON, TTL=55s
```

### Endpoints
```
GET  /api/health
GET  /api/synth/percentiles/all?horizon=24h
GET  /api/analytics/derived/all?horizon=24h
GET  /api/analytics/scanner?horizon=24h
POST /api/analytics/kelly
GET  /api/analytics/liquidation-risk
GET  /api/portfolio/positions?address=0x...
```

---

## Frontend: Next.js 15 (App Router)

```
app/
├── layout.tsx           # Dark theme, fonts, QueryProvider
├── page.tsx             # Landing: enter Synth API key
├── terminal/
│   ├── layout.tsx       # Shell: sidebar + header + status bar
│   ├── page.tsx         # Dashboard: scanner + cone + heatmap
│   └── asset/[symbol]/
│       └── page.tsx     # Asset deep-dive
└── settings/page.tsx    # Config
```

### Polling (TanStack Query)
```typescript
useQuery({
  queryKey: ['synth', 'all', horizon],
  queryFn: () => api.getSynthAll(horizon),
  refetchInterval: 10_000,
})
```

---

## Pencil.dev — Full Design Authority

Pencil decides layout, spacing, component choice, chart library per visualization, animations.
See `skills/DESIGN_SYSTEM.md` for constraints and prompts.
Only 2 pages: `dashboard.pen` + `asset-detail.pen`.

---

## Build Order (8 hours)

1. **Hour 1** — Backend: Synth polling → Redis cache → derivations → endpoints
2. **Hour 2** — Backend: All analytics endpoints + HL position reads
3. **Hour 3** — Frontend: Shell (Pencil designs), dashboard with scanner table
4. **Hour 4** — Frontend: Probability Cone (D3.js) — THE hero feature
5. **Hour 5** — Frontend: Heatmap + asset deep-dive page
6. **Hour 6** — Frontend: Portfolio view + Kelly calculator
7. **Hour 7** — Polish: loading states, errors, animations
8. **Hour 8** — Deploy to Ubuntu + record demo + submit

---

## Gotchas

1. Synth equities have X suffix: SPYX, NVDAX, TSLAX, AAPLX, GOOGLX
2. 24h=289 timesteps, 1h=61 timesteps
3. `current_price` comes in percentiles response — don't make separate calls
4. TradingView needs attribution link in footer
5. HL unavailable in USA/UK — add disclaimer
6. `next.config.ts` needs `output: 'standalone'` for Docker
7. `NEXT_PUBLIC_*` vars set at BUILD time
8. If Synth API fails → serve from mock JSON files. Demo must work regardless.
9. All time UTC
10. Redis TTL=55s, poll=60s — data always fresh

---

## Skills Index

| Skill | When to read |
|-------|-------------|
| `skills/HACKATHON_SPEED.md` | **FIRST. Always.** Priorities, what to cut, build order. |
| `skills/SYNTH_API.md` | Synth data fetching, derivation formulas, caching |
| `skills/HYPERLIQUID.md` | Portfolio reads, asset mapping |
| `skills/ANALYTICS.md` | VaR, Kelly, regime, funding arb — full code |
| `skills/DESIGN_SYSTEM.md` | Frontend design, Pencil.dev prompts, color palette |
| `skills/API_DESIGN.md` | Backend endpoints, Pydantic models |
| `skills/DATABASE.md` | PostgreSQL schema, Redis keys |
| `skills/INFRASTRUCTURE.md` | Ubuntu 24.04 deployment, Nginx, SSL, Docker |
| `skills/SECURITY.md` | Key handling, CORS, disclaimers |
| `skills/OPEN_SOURCE.md` | Reference projects, library links |
| `skills/TESTING.md` | QA checklist, demo video shot list |
