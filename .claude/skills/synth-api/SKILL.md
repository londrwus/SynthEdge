# SKILL: Synth API Integration

## Overview
How to efficiently integrate with the Synth API in the SynthEdge project.

## API Base
```
Base URL: https://api.synthdata.co
Auth Header: Authorization: Apikey {USER_KEY}
```

## Assets (use EXACT strings)
```
Crypto:      BTC, ETH, SOL
Commodities: XAU
Equities:    SPYX, NVDAX, TSLAX, AAPLX, GOOGLX
```

## Primary Endpoint — Prediction Percentiles
```
GET /insights/prediction-percentiles?asset={ASSET}&horizon={1h|24h}&days=14&limit=10
```

Returns 9 percentile levels at every timestep:
- `0.005` (0.5th) — extreme downside
- `0.05` (5th) — strong downside
- `0.2` (20th) — moderate downside
- `0.35` (35th) — mild downside
- `0.5` (50th) — **median forecast**
- `0.65` (65th) — mild upside
- `0.8` (80th) — moderate upside
- `0.95` (95th) — strong upside
- `0.995` (99.5th) — extreme upside

Timesteps: 289 for 24h (5min intervals), 61 for 1h (1min intervals).

Response includes: `current_price`, `forecast_future.percentiles`, `forecast_past.percentiles`, `realized.prices`.

## Local Derivations from Percentiles

### Implied Volatility (annualized approximation)
```python
def implied_vol_from_percentiles(percentiles_at_horizon: dict, current_price: float, horizon_hours: float) -> float:
    p95 = percentiles_at_horizon["0.95"]
    p05 = percentiles_at_horizon["0.05"]
    range_pct = (p95 - p05) / current_price
    # Scale to annualized: multiply by sqrt(8760 / horizon_hours)
    annual_factor = (8760 / horizon_hours) ** 0.5
    # 90% confidence interval ≈ 2 * 1.645 sigma
    sigma = range_pct / (2 * 1.645)
    return sigma * annual_factor
```

### Directional Probability
```python
def directional_probability(percentiles_at_horizon: dict, current_price: float) -> dict:
    median = percentiles_at_horizon["0.5"]
    p35 = percentiles_at_horizon["0.35"]
    p65 = percentiles_at_horizon["0.65"]
    
    # Simple: if median > current, lean is bullish
    lean = "bullish" if median > current_price else "bearish"
    
    # Conviction: how far median deviates from current as % of distribution width
    width = p65 - p35
    deviation = abs(median - current_price)
    conviction = min(deviation / max(width, 0.001), 1.0)
    
    # Approximate up probability from where current_price sits in the distribution
    # If current_price < p35 → >65% up probability
    # If current_price < p50 → >50% up probability
    # Interpolate between percentile levels
    return {"lean": lean, "conviction": conviction, "median": median}
```

### Liquidation Risk
```python
def liquidation_probability(percentiles_at_horizon: dict, liquidation_price: float) -> float:
    """Estimate probability of hitting liquidation price within horizon."""
    levels = sorted(percentiles_at_horizon.items(), key=lambda x: float(x[0]))
    
    for i, (pct, price) in enumerate(levels):
        if liquidation_price <= price:
            if i == 0:
                return float(pct)  # Below lowest percentile
            prev_pct, prev_price = levels[i-1]
            # Linear interpolation
            frac = (liquidation_price - prev_price) / (price - prev_price)
            return float(prev_pct) + frac * (float(pct) - float(prev_pct))
    
    return 1.0  # Above highest percentile
```

### Skew
```python
def distribution_skew(p: dict) -> float:
    """Positive = right-skewed (fatter upside tail)."""
    upside = p["0.95"] - p["0.5"]
    downside = p["0.5"] - p["0.05"]
    return (upside - downside) / max(upside + downside, 0.001)
```

### Kurtosis Proxy
```python
def distribution_kurtosis_proxy(p: dict) -> float:
    """Higher = fatter tails relative to body."""
    tail_range = p["0.995"] - p["0.005"]
    body_range = p["0.8"] - p["0.2"]
    return tail_range / max(body_range, 0.001)
```

## Dedicated Insight Endpoints (use sparingly)

### Volatility
```
GET /insights/volatility?asset={ASSET}&horizon={1h|24h}
```
Returns forward-looking and realized volatility. Only call when user opens Volatility deep-dive.

### Option Pricing
```
GET /insights/option-pricing?asset={ASSET}&horizon={1h|24h}
```
Returns theoretical call/put prices at multiple strikes. Only call in Options view.

### Liquidation
```
GET /insights/liquidation?asset={ASSET}&horizon={1h|24h}
```
Returns precise liquidation probabilities. Only call in Liquidation Guardian.

## Caching Strategy
```python
CACHE_KEY = f"synth:{asset}:{horizon}"
CACHE_TTL = 55  # seconds (poll every 60s)
POLL_INTERVAL = 60  # seconds

# One fetch → cache → all components read from cache
async def poll_synth_percentiles(asset: str, horizon: str):
    data = await synth_client.get_percentiles(asset, horizon)
    await redis.setex(f"synth:{asset}:{horizon}", CACHE_TTL, json.dumps(data))
    await redis.publish(f"synth:update:{asset}", horizon)
```

## Horizon Guide
| Horizon | Use Case | Update Freq |
|---------|----------|-------------|
| `1h` | Scalping, intraday signals, short-term risk | Every 12 min (Synth side) |
| `24h` | Swing trades, daily risk, portfolio VaR | Every 60 min (Synth side) |

Both are useful. Default views should show 24h, with toggle to 1h.
