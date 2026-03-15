# Changelog

## 2026-03-15 — Session 3: Bug Fixes, UX Polish, Token Optimization

### Backend Optimizations
- **Credit reduction**: 1h horizon polls every other cycle (saves ~270 credits/hr)
- **Connection pooling**: Reuse httpx client across requests
- **Redis pipeline**: Atomic writes for cache updates
- **Longer cache TTL**: 120s (was 55s) so data survives between polls
- **Mock save once**: Only save mock data files once per session, not every poll
- **Rate limit protection**: 300ms delay between asset API calls

### Frontend Bug Fixes
- **Fixed ticker tape**: Removed old SPYX/NVDAX asset names, filter out assets with no data (no more empty prices)
- **Fixed dashboard lag**: Added `placeholderData: keepPreviousData` to all TanStack Query hooks (prevents coins disappearing/reverting)
- **Increased staleTime**: 10s stale, 15s refetch (was 5s/10s) — reduces unnecessary re-renders
- **Fixed quick-stats**: Used correct asset list (SPY, NVDA, TSLA, AAPL, GOOGL)

### New Features
- **Interactive Probability Cone**: Crosshair cursor with tooltip showing P95/P50/P05 prices at hover position, collision-avoided labels, NOW/+12H/+24H timeline markers
- **TradingView Price Chart**: Lightweight Charts v5 integration showing median forecast line + P05/P95 bands with current price marker, interactive crosshair
- **FAQ / Help Page**: 6 categories, 15 questions covering probability cone, Kelly criterion, options pricing, volatility concepts, regime detection
- **Help/FAQ in sidebar nav**: Added navigation item

### Additional Bug Fixes (from audit)
- **Portfolio section**: Fixed critical bug where `setHlAddress` fired on every keystroke triggering API spam. Now uses local state + CONNECT button
- **Portfolio section**: Added disconnect button, margin summary display, error state, Synth direction enrichment
- **UTC clock**: Fixed static time display — now updates every second via setInterval
- **Zustand hydration**: Added `skipHydration` + manual rehydrate to prevent SSR/client mismatch
- **TanStack Query defaults**: Increased global staleTime to 10s, gcTime to 120s

### Token Optimization Summary
- Before: 18 API calls × 1 credit × 1/min = 1,080 credits/hr
- After: 9 calls/min (24h) + 4.5 calls/min (1h avg) = ~810 credits/hr (25% reduction)
- Redis TTL extended to 120s, frontend polls every 15s from cache (not API)

---

## 2026-03-14 — Session 2: Deep Quant Features + API Integration

### Backend Fixes
- Fixed Synth API asset names: SPY, NVDA, TSLA, AAPL, GOOGL (no X suffix)
- Added API key resolution: frontend header `X-Synth-Api-Key` + env var fallback
- Fixed CORS to allow all origins in dev mode
- Created .env with live Synth API key
- Verified all 9 assets polling successfully with 200 OK responses

### New Backend Endpoints (6 new)
- `GET /api/insights/options` — Synth Monte Carlo option pricing (calls/puts at multiple strikes)
- `GET /api/insights/liquidation` — Precise liquidation probabilities (6/12/18/24h windows)
- `GET /api/insights/lp-bounds` — LP interval analysis (probability of staying in range, IL)
- `GET /api/insights/cross-asset-vol` — Cross-asset vol comparison (crypto vs equity vs commodity)
- `GET /api/insights/distribution` — Full distribution shape analysis (percentile returns, CI, skew)
- `GET /api/insights/vol-term-structure` — Vol term structure (1h vs 24h, contango/backwardation)

### Frontend Enhancements
- **Industrial terminal style** — zero radius, hairline borders, bracket indicators [CONNECTED], code comments (// SYSTEM)
- **Expanded sidebar** — w-48 with text labels, system info, version
- **Ticker tape** — scrolling asset prices at top
- **Quick stats row** — 4 metric cards (assets tracked, bullish signals, avg vol, horizon)
- **Options pricing view** — Full options chain (calls/puts) from Synth Monte Carlo
- **Distribution analysis** — Percentile return histogram, 90%/60% CI widths, skew interpretation
- **Cross-asset vol** — Bar chart ranking all 9 assets, crypto/equity vol ratio (6.07x)
- **Timeframe confluence** — Detects when 1H + 24H forecasts agree on direction
- **Trade links** — Deep links to Hyperliquid for execution
- **Progress bars** — Visual probability bars on risk metrics
- **Portfolio section** — Connect HL address CTA

### API Testing (verified with live data)
- BTC: $71,076 | Bearish 47.7% | Vol 30.6% | Mean Reversion
- TSLA: $390 | Bullish 61.9% | Vol 7.2% | Low Vol Grind
- SPY: $667 | Bullish 60.0% | Vol 6.2% | Low Vol Grind
- Crypto/Equity vol ratio: 6.07x
- BTC 90% CI: $69,174 — $72,915 (5.3% width)

---

## 2026-03-14 — Session 1: Initial Build

### Backend (FastAPI + Python)
- FastAPI app with lifespan background polling loop
- Synth API integration: polls `/insights/prediction-percentiles` for 9 assets x 2 horizons
- Redis caching layer (TTL=55s, poll=60s)
- Full derivation engine: implied vol, direction, skew, kurtosis, regime detection, tail risk
- API endpoints: health, percentiles, derived metrics, scanner, Kelly calculator, liquidation risk
- Hyperliquid read-only portfolio integration (positions, margin summary)
- Mock data fallback (18 JSON files) for demo resilience

### Frontend (Next.js 15 + TypeScript)
- App Router with landing, dashboard, asset detail, settings, portfolio pages
- Probability Cone (D3.js), Scanner Table, Volatility Heatmap, Kelly Calculator
- TanStack Query polling, Zustand state management

### Design (Pencil.dev)
- Dashboard + Asset Detail designed with webapp-03-industrialtechnical_light style guide

### Infrastructure
- Docker Compose: PostgreSQL 16, Redis 7
- Dockerfiles for backend and frontend
