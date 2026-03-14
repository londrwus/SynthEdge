# SKILL: Backend API Design

## Base URL
```
Development: http://localhost:8000
Production:  https://api.synthedge.app
```

## Authentication
All endpoints require `X-Synth-Api-Key` header (user's Synth API key, passed through).
Portfolio/trading endpoints also need `X-HL-Address` header (user's public HL address).

## Endpoints

### Synth Data (proxied + cached)

```
GET /api/synth/percentiles?asset=BTC&horizon=24h
  → Returns cached Synth prediction percentiles
  → Source: Redis cache, refreshed by Celery every 60s

GET /api/synth/percentiles/all?horizon=24h
  → Returns percentiles for ALL 9 assets in one call
  → Frontend uses this for dashboard overview

GET /api/synth/volatility?asset=BTC&horizon=24h
  → Proxies to /insights/volatility (only called on-demand)

GET /api/synth/option-pricing?asset=NVDAX&horizon=24h
  → Proxies to /insights/option-pricing (only called on-demand)

GET /api/synth/liquidation?asset=BTC&horizon=24h
  → Proxies to /insights/liquidation (only called on-demand)
```

### Derived Analytics (computed from cached percentiles)

```
GET /api/analytics/derived?asset=BTC&horizon=24h
  → Returns locally-derived metrics from percentiles
  → Response:
  {
    "asset": "BTC",
    "horizon": "24h",
    "current_price": 84500.0,
    "implied_vol_annualized": 0.42,
    "up_probability": 0.62,
    "skew": 0.15,
    "kurtosis_proxy": 3.8,
    "regime": "low_vol_grind",
    "regime_description": "Low volatility, tight ranges...",
    "tail_risk": {
      "prob_2pct_drop": 0.08,
      "prob_5pct_drop": 0.02,
      "prob_10pct_drop": 0.003
    },
    "updated_at": "2026-03-14T10:00:00Z"
  }

GET /api/analytics/derived/all?horizon=24h
  → Returns derived metrics for ALL assets

GET /api/analytics/scanner?horizon=24h&min_probability=0.6
  → Returns directional scanner (filtered by threshold)
  → Response: array of assets with direction, probability, vol, regime

GET /api/analytics/confluence?asset=BTC
  → Returns 1h + 24h confluence analysis
  → Compares both horizons for agreement/disagreement
```

### Risk Analytics

```
POST /api/analytics/var
  Body: { "positions": [{"asset": "BTC", "notional": 10000, "direction": "long"}] }
  → Returns VaR, CVaR, per-position contribution

POST /api/analytics/kelly
  Body: { "asset": "BTC", "direction": "long", "entry": 84500, "tp": 87000, "sl": 82000 }
  → Returns Kelly fraction, recommended size, win/loss probabilities

GET /api/analytics/liquidation-risk?asset=BTC&entry_price=84500&leverage=5&direction=long
  → Returns probability of liquidation from Synth distributions

GET /api/analytics/funding-arb?horizon=24h
  → Returns funding rate arbitrage signals across all assets
```

### Portfolio

```
GET /api/portfolio/positions?address=0x...
  → Returns user's Hyperliquid positions (read from HL Info API)
  → Enriched with Synth-derived risk metrics per position

GET /api/portfolio/summary?address=0x...
  → Returns portfolio summary: total value, P&L, VaR, risk breakdown

GET /api/portfolio/ideas?address=0x...
  → Returns AI-generated trade ideas based on current portfolio + Synth forecasts
```

### Trade Journal

```
GET    /api/journal?address=0x...&limit=50&offset=0
POST   /api/journal
PUT    /api/journal/{id}
DELETE /api/journal/{id}

POST /api/journal/enrich
  Body: { "asset": "BTC", "entry_price": 84500, "direction": "long" }
  → Returns current Synth context to attach to a trade entry
```

### Accuracy Tracking

```
GET /api/accuracy/scoreboard?asset=BTC&days=30
  → Returns Synth forecast accuracy: predicted vs realized moves
  → Shows hit rate for confidence bands (90%, 60%, 30%)

GET /api/accuracy/latest?asset=BTC
  → Returns most recent forecast vs outcome comparison
```

### System

```
GET /api/health
  → Returns status of all services (Synth API, HL, Postgres, Mongo, Redis)

WebSocket /ws
  → Real-time updates: synth data, HL fills, alerts
```

## Response Format

All responses follow:
```json
{
  "data": { ... },           // The actual payload
  "meta": {
    "cached": true,          // Whether served from cache
    "cached_at": "...",      // When cache was populated
    "source": "synth_api"    // Data source
  }
}
```

Error responses:
```json
{
  "error": {
    "code": "SYNTH_API_ERROR",
    "message": "Invalid Synth API key",
    "status": 401
  }
}
```

## Pydantic Models (examples)

```python
from pydantic import BaseModel
from datetime import datetime

class DerivedMetrics(BaseModel):
    asset: str
    horizon: str
    current_price: float
    implied_vol_annualized: float
    up_probability: float
    skew: float
    kurtosis_proxy: float
    regime: str
    regime_description: str
    tail_risk: dict
    updated_at: datetime

class KellyRequest(BaseModel):
    asset: str
    direction: str  # "long" | "short"
    entry: float
    tp: float
    sl: float
    fraction: float = 0.5  # Half-Kelly default

class KellyResponse(BaseModel):
    kelly_fraction: float
    win_probability: float
    loss_probability: float
    avg_win_pct: float
    avg_loss_pct: float
    recommended_position_pct: float

class PortfolioPosition(BaseModel):
    asset: str
    direction: str
    size: float
    entry_price: float
    current_price: float
    leverage: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    liquidation_price: float | None
    synth_up_probability: float
    synth_regime: str
    liquidation_risk_pct: float | None
```
