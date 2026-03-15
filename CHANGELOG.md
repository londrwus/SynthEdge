# Changelog

## 2026-03-15 — Session 4: Major Feature Expansion + Research + Production

### API Cost Optimization (CRITICAL FIX)
- **Reduced from ~1000 credits/hr to ~144 credits/hr** (85% reduction)
- Default poll interval: 5 minutes (was 60s)
- 1h horizon polled every 3rd cycle only
- Redis TTL: 10 minutes (was 55s)
- Connection pooling for httpx client
- Mock data saved once per session
- Added `/api/refresh` endpoint for manual force-refresh (costs 18 credits)
- Added `/api/health` polling status with credit estimate

### New Pages (7 total navigation tabs)
1. **Dashboard** — Scanner, probability cone, heatmap, cross-asset vol
2. **Screener** — Equity/crypto/commodity ranking by up probability, conviction, vol
3. **Asset Detail** — TradingView chart, probability cone, trade panel, Kelly, regime, options, distribution
4. **Risk Monitor** — VaR dashboard, tail risk bars, vol term structure, regime recommendations
5. **Portfolio** — Hyperliquid positions with Synth enrichment, margin summary
6. **Help / FAQ** — 15 questions across 6 categories
7. **Settings** — API keys, display preferences, about

### Hyperliquid Trading Integration (7 new endpoints)
- `POST /api/trading/market-order` — Market buy/sell on HL
- `POST /api/trading/limit-order` — Limit orders with price
- `POST /api/trading/close` — Close position
- `POST /api/trading/cancel` — Cancel order
- `POST /api/trading/smart-order` — **Synth-powered smart order** (SL/TP from distribution percentiles)
- `GET /api/trading/open-orders` — View open orders
- `GET /api/trading/user-fills` — Trade history
- Trade panel component with LONG/SHORT, market/smart mode, Synth signal display
- Tested with user's wallet: connection verified, BTC mid $70,934

### TradingView Chart Improvements
- Area series for P05/P95 bands (not just lines)
- P20/P80 dotted boundary lines
- Interactive zoom/scroll enabled
- Crosshair with labels
- Proper resize observer
- Current price (SPOT) marker

### Probability Cone Improvements
- Interactive crosshair with tooltip (P95/P50/P05 prices at hover position)
- Collision-avoided band labels
- NOW/+12H/+24H timeline markers
- ResizeObserver for responsive sizing
- Smart price formatting (adapts to price magnitude)

### Security Audit
- No hardcoded secrets ✓
- .env files in .gitignore ✓
- No SQL injection vectors ✓
- No XSS (no dangerouslySetInnerHTML) ✓
- Private keys never stored, used per-request only ✓
- CORS configured (wildcard dev, restricted prod) ✓

### Backend Architecture (24 API endpoints)
- FastAPI with async background polling
- Redis caching with pipeline writes
- 6 insight endpoints (options, liquidation, LP bounds, cross-asset vol, distribution, vol term structure)
- 7 trading endpoints (market, limit, close, cancel, smart order, open orders, fills)
- All derivation math computed locally from percentiles

### Frontend Architecture (10 routes)
- Next.js 15 App Router + TypeScript
- TanStack Query with keepPreviousData (no flicker)
- Zustand with SSR-safe hydration
- TradingView Lightweight Charts v5
- D3.js probability cone with interactive crosshair
- Industrial terminal design (JetBrains Mono, zero radius, bracket indicators)

---

## Previous Sessions

### 2026-03-14 — Session 1: Initial Build
- Full backend + frontend skeleton
- Probability cone, scanner, heatmap, Kelly calculator
- Pencil.dev designs

### 2026-03-14 — Session 2: Deep Quant Features
- 6 new insight endpoints
- Options pricing, distribution analysis, cross-asset vol
- API key integration, asset name fixes

### 2026-03-15 — Session 3: Bug Fixes
- Fixed ticker tape, dashboard lag, portfolio section
- UTC clock, Zustand hydration, staleTime optimization
