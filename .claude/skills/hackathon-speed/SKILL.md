# SKILL: Hackathon Speed — 8 Hours Left

## CRITICAL: Read This First

We have ~8 hours. Every decision must be: **"Will judges see this in the 1-min demo?"**

If the answer is no → SKIP IT.

---

## What We CUT (saves hours of debugging)

| Cut | Why | Replacement |
|-----|-----|-------------|
| **Rust / PyO3** | Compilation, FFI, maturin setup = 1-2hr lost | Plain Python + NumPy. The math is not the bottleneck. |
| **Celery + Beat** | Broker setup, worker debugging, task serialization | FastAPI `lifespan` + `asyncio.create_task` background loop |
| **MongoDB** | Extra DB, extra driver, extra schema | Redis for cache, PostgreSQL for everything persistent |
| **Alembic migrations** | Schema versioning for a hackathon? | Raw `init.sql` script, run once |
| **Complex testing** | pytest fixtures, mocks, coverage | Manual testing. If the demo works, ship it. |
| **Trade Journal** | Nice to have, judges won't see depth | Stretch goal if time left |
| **Portfolio Ideas AI** | LLM integration, prompt engineering | Stretch goal |
| **Multiple Pencil .pen files** | Design 5 pages? No. | Design 2 max: dashboard + asset page |
| **Custom WebSocket protocol** | Complex state sync | SSE (Server-Sent Events) or simple polling via TanStack Query |
| **Wallet integration (signing)** | Client-side crypto signing is fragile | READ-ONLY mode: user enters HL address, we show positions + analytics. Trade button = deep link to Hyperliquid. |

## What We KEEP (judges will see)

| Feature | Why | Effort |
|---------|-----|--------|
| **Probability Cones** | THE visual. Most impressive chart. Shows Synth data beautifully. | 2-3h |
| **Directional Scanner** | Table of all 9 assets with up/down probability, vol, regime | 1h |
| **Volatility Heatmap** | Cross-asset view, very visual, shows breadth of Synth coverage | 1-2h |
| **Portfolio View (read-only)** | User enters HL address → see positions enriched with Synth risk data | 1-2h |
| **Kelly Position Sizer** | Interactive calculator: input trade → get size. Very demo-able. | 1h |
| **Terminal Shell (dark neon UI)** | The "wow factor". Dark, glowing, professional. | 1h (Pencil does most of it) |
| **Liquidation Risk per position** | Derived from Synth percentiles, shows on portfolio. Very relevant. | 30min |
| **Funding Rate + Synth comparison** | Novel signal, unique to our project | 30min |

## Simplified Architecture (Actually Buildable in 8h)

```
┌─────────────────────────────┐
│   FRONTEND (Next.js 15)     │
│   Tailwind + shadcn/ui      │
│   TradingView Lightweight   │
│   D3.js (cones, heatmap)    │
│   TanStack Query (polling)  │
│   Zustand (state)           │
└─────────┬───────────────────┘
          │ HTTP (polling every 5-10s from frontend)
┌─────────┴───────────────────┐
│   BACKEND (FastAPI)         │
│   Background task: polls    │
│   Synth API every 60s →     │
│   caches in Redis           │
│   Reads HL Info API         │
│   Derives analytics         │
└──┬──────────┬───────────────┘
   │          │
┌──┴───┐  ┌──┴────┐
│Redis │  │Postgres│
│cache │  │journal │
└──────┘  └───────┘
```

No WebSocket. No Celery. No MongoDB. No Rust. Frontend polls backend every 5-10s via TanStack Query. Backend has a background asyncio loop that polls Synth every 60s. Simple, debuggable, works.

## Build Order (8 hours, minute by minute)

### Hour 1: Skeleton + Backend Core
- [ ] `docker-compose up -d` (Postgres + Redis)
- [ ] FastAPI app with health endpoint
- [ ] Synth service: fetch percentiles, cache in Redis
- [ ] Background loop: poll all 9 assets × 2 horizons every 60s
- [ ] `/api/synth/percentiles` and `/api/synth/percentiles/all` endpoints
- [ ] Derivations module: vol, direction, skew, kurtosis, regime

### Hour 2: All Backend Endpoints
- [ ] `/api/analytics/derived/all` — all assets derived metrics
- [ ] `/api/analytics/scanner` — directional scanner data
- [ ] `/api/analytics/kelly` — Kelly calculator
- [ ] `/api/analytics/liquidation-risk` — from percentiles
- [ ] `/api/portfolio/positions` — read from HL Info API
- [ ] `/api/portfolio/summary` — enriched with Synth data

### Hour 3: Frontend Shell + Dashboard
- [ ] Next.js project init with Tailwind + shadcn/ui
- [ ] Terminal layout: sidebar, header, status bar
- [ ] Dark theme CSS variables applied
- [ ] Dashboard page: scanner table (all assets with probabilities)
- [ ] TanStack Query hooks for all backend endpoints

### Hour 4: Probability Cone Chart (THE KEY FEATURE)
- [ ] D3.js probability cone component
- [ ] Fetches percentile data for selected asset
- [ ] Renders 5 bands (5-95, 20-80, 35-65, median line)
- [ ] Current price overlay
- [ ] 1h / 24h toggle
- [ ] This is the hero of the demo. Spend time here.

### Hour 5: Volatility Heatmap + Asset Page
- [ ] Heatmap component (D3.js or simple CSS grid with color gradients)
- [ ] Asset deep-dive page layout
- [ ] Regime badge, tail risk metrics, vol comparison
- [ ] Link from scanner → asset page

### Hour 6: Portfolio + Kelly
- [ ] Settings page: enter Synth API key + HL public address
- [ ] Portfolio page: fetch positions from HL, display with Synth enrichment
- [ ] Liquidation risk per position (derived from percentiles)
- [ ] Kelly calculator: interactive form + result display
- [ ] Funding rate comparison (fetch from HL, compare with Synth direction)

### Hour 7: Polish + Edge Cases
- [ ] Loading states (pulsing neon bars)
- [ ] Error states (API key invalid, no data)
- [ ] Empty states (no positions)
- [ ] Responsive fixes
- [ ] Animations (Framer Motion on number changes, panel transitions)
- [ ] Footer with disclaimers + TradingView attribution

### Hour 8: Deploy + Demo
- [ ] Deploy to Ubuntu server
- [ ] Nginx + SSL setup
- [ ] Test with real Synth API key
- [ ] Record 1-min demo video
- [ ] Write/finalize 1-page technical explanation
- [ ] Push to GitHub, submit

## Decision Framework

When you're unsure about something, ask:
1. **Will judges see it?** No → Skip.
2. **Can I fake it?** Yes → Hardcode/mock it, add real data later.
3. **Is it blocking the demo flow?** No → Defer.
4. **Does it touch the selection criteria?** If it's probabilistic modeling or Synth API depth → prioritize. If it's infrastructure polish → defer.

## Mock Data Strategy

If Synth API is slow or you run out of credits:
- Cache one real response per asset in a JSON file
- Backend serves from file as fallback
- Demo still works perfectly
- Judges can't tell the difference

```python
# Quick mock fallback
import json
from pathlib import Path

MOCK_DIR = Path("mock_data")

async def get_percentiles(asset: str, horizon: str, api_key: str) -> dict:
    # Try real API
    try:
        return await _fetch_real(asset, horizon, api_key)
    except Exception:
        # Fallback to mock
        mock_file = MOCK_DIR / f"{asset}_{horizon}.json"
        if mock_file.exists():
            return json.loads(mock_file.read_text())
        raise
```
