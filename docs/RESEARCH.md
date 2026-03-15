# SynthEdge Research Document

> Comprehensive research across four areas for the Synth Hackathon 2026 "Best Equities Application" category.
> Generated: 2026-03-15

---

## Table of Contents

1. [Research 1: Feature Analysis and Prioritization](#research-1-feature-analysis-and-prioritization)
2. [Research 2: API Cost Optimization](#research-2-api-cost-optimization)
3. [Research 3: Technical Performance Improvements](#research-3-technical-performance-improvements)
4. [Research 4: Hyperliquid Trading Integration](#research-4-hyperliquid-trading-integration)

---

## Research 1: Feature Analysis and Prioritization

### Current Feature Inventory

SynthEdge already implements these features (mapped to selection criteria):

| Feature | Criteria Served | Status |
|---------|----------------|--------|
| Probability cone visualizer (D3.js) | Probabilistic Modeling (30%), Innovation (15%) | Done |
| Directional scanner (9 assets) | Practical Market Relevance (25%) | Done |
| Volatility heatmap (1h vs 24h) | Probabilistic Modeling (30%) | Done |
| Kelly position sizer | Practical Market Relevance (25%), Probabilistic Modeling (30%) | Done |
| Regime detection (4 regimes) | Innovation (15%), Probabilistic Modeling (30%) | Done |
| Cross-asset vol comparison | Probabilistic Modeling (30%) | Done |
| Distribution analysis | Probabilistic Modeling (30%) | Done |
| Options pricing view (Synth MC) | Technical Implementation (30%) | Done |
| Multi-timeframe confluence | Innovation (15%) | Done |
| TradingView chart | Technical Implementation (30%) | Done |
| Vol term structure | Probabilistic Modeling (30%) | Done |
| Liquidation risk calculator | Practical Market Relevance (25%) | Done |
| HL portfolio enrichment | Technical Implementation (30%) | Done |

### Missing High-Value Features: Detailed Analysis

#### 1. Smart Stop-Loss / Take-Profit Levels from Percentiles

**Concept:** Automatically generate SL/TP levels using Synth's probability distribution rather than fixed percentages or ATR. For example, set TP at the 80th percentile price and SL at the 20th percentile price for a 60% probability of profit.

**Implementation approach:**
```python
def smart_sl_tp(percentiles: dict, current_price: float, direction: str = "long"):
    if direction == "long":
        return {
            "conservative_tp": percentiles["0.65"],   # 35% probability of hitting
            "standard_tp": percentiles["0.8"],         # 20% probability
            "aggressive_tp": percentiles["0.95"],      # 5% probability
            "conservative_sl": percentiles["0.35"],    # 35% probability of hitting
            "standard_sl": percentiles["0.2"],         # 20% probability
            "aggressive_sl": percentiles["0.05"],      # 5% probability
            "risk_reward_standard": (percentiles["0.8"] - current_price) /
                                   (current_price - percentiles["0.2"]),
        }
```

- **Effort:** 1-2 hours (backend derivation + frontend display)
- **Criteria impact:** Practical Market Relevance (+high), Probabilistic Modeling (+medium)
- **Verdict: BUILD THIS.** Directly useful for traders. Every SL/TP becomes probabilistically grounded. Judges will appreciate that standard trading tools (SL/TP) are re-derived from Synth distributions rather than arbitrary fixed values.

#### 2. Funding Rate Arbitrage Dashboard

**Concept:** Compare Hyperliquid funding rates against Synth's directional forecast. When funding is strongly negative (shorts paying longs) but Synth predicts bullish, that is an alpha signal.

**Implementation approach:**
```python
from hyperliquid.info import Info
info = Info(constants.MAINNET_API_URL, skip_ws=True)
meta = info.meta()
# Extract funding rates per asset from meta["universe"]
# Compare against Synth directional lean + conviction
```

- **Effort:** 2-3 hours (fetch HL funding data + comparison logic + frontend panel)
- **Criteria impact:** Practical Market Relevance (+high), Innovation (+medium), Technical Implementation (+medium)
- **Verdict: SKIP for now.** Too much effort for the remaining time. Funding rates require additional HL API integration and the edge signal is subtle. Good for a v2.

#### 3. Equity Screener with Probabilistic Ranking

**Concept:** Rank the 5 equity assets (SPY, NVDA, TSLA, AAPL, GOOGL) by a composite score derived from: directional probability, implied vol attractiveness, skew favorability, and regime suitability.

**Implementation approach:**
```python
def equity_score(derived: dict) -> float:
    direction_score = derived["up_probability"] if direction == "bullish" else (1 - derived["up_probability"])
    vol_score = 1.0 if derived["regime"] in ("low_vol_grind", "high_vol_trend") else 0.5
    skew_score = max(0, derived["skew"]) if direction == "bullish" else max(0, -derived["skew"])
    return 0.4 * direction_score + 0.3 * vol_score + 0.3 * skew_score
```

- **Effort:** 1 hour (backend endpoint + frontend table/card)
- **Criteria impact:** Practical Market Relevance (+high for equities category), Innovation (+low)
- **Verdict: BUILD THIS.** We are in the "Best Equities Application" category. Having an explicit equity-focused screener that ranks stocks by probabilistic criteria is directly relevant. It is fast to implement since all data already exists in cache.

#### 4. Equity Pairs Divergence Detector

**Concept:** Detect when two equities' Synth forecasts diverge unusually. For example, if NVDA shows bullish and TSLA shows bearish while they normally correlate, that is a pairs trade signal.

**Implementation approach:**
```python
# Compare directional lean and vol for pairs: NVDA/TSLA, AAPL/GOOGL, etc.
# Flag when directions diverge or vol ratio deviates from recent average
pairs = [("NVDA", "TSLA"), ("AAPL", "GOOGL"), ("SPY", "NVDA")]
for a, b in pairs:
    da = get_derived(a)
    db = get_derived(b)
    divergence = abs(da["up_probability"] - db["up_probability"])
    if divergence > 0.15:  # threshold
        signal = "DIVERGENCE"
```

- **Effort:** 1-2 hours (logic is simple, need frontend visualization)
- **Criteria impact:** Innovation (+high), Probabilistic Modeling (+medium), Practical Market Relevance (+medium)
- **Verdict: BUILD THIS.** Pairs trading is a well-understood strategy, and grounding it in probabilistic forecasts is novel. The implementation is lightweight since we already cache all derived metrics.

#### 5. Expected Move Tracker vs Realized

**Concept:** Track Synth's predicted move (90% CI width) against what actually happened. Shows forecast accuracy and calibration.

**Implementation approach:** Requires historical storage of past predictions and comparing against realized prices. Need a simple PostgreSQL table to log predictions.

- **Effort:** 3-4 hours (database schema + recording logic + comparison UI + charting)
- **Criteria impact:** Probabilistic Modeling (+high), Innovation (+medium)
- **Verdict: SKIP.** Too much effort. Requires historical data accumulation that does not exist yet. Would need to run for days to have meaningful data.

#### 6. Sector Rotation Signal Board

**Concept:** Group equities by implicit sector (tech: NVDA/TSLA/AAPL/GOOGL, broad: SPY) and show which sector Synth forecasts favor. Include crypto as an "alternative" sector.

**Implementation approach:**
```python
SECTORS = {
    "tech": ["NVDA", "TSLA", "AAPL", "GOOGL"],
    "index": ["SPY"],
    "crypto": ["BTC", "ETH", "SOL"],
    "commodity": ["XAU"],
}
# Average up_probability and vol per sector
# Show rotation signal: "Rotate into TECH" vs "Rotate into CRYPTO"
```

- **Effort:** 1 hour (data already cached, just aggregation + display)
- **Criteria impact:** Practical Market Relevance (+medium), Innovation (+low)
- **Verdict: MAYBE.** Quick to build and adds visual appeal. Low innovation score but reinforces equity focus. Build only if time permits after higher priority items.

### Feature Priority Matrix (Remaining 2 Hours)

| Priority | Feature | Effort | Impact | Build? |
|----------|---------|--------|--------|--------|
| 1 | Smart SL/TP from percentiles | 1h | HIGH | YES |
| 2 | Equity probabilistic screener | 0.5h | HIGH | YES |
| 3 | Pairs divergence detector | 1h | MEDIUM-HIGH | YES if time |
| 4 | Sector rotation board | 0.5h | MEDIUM | If time |
| 5 | Funding rate arb | 2h+ | MEDIUM | NO |
| 6 | Expected move tracker | 3h+ | MEDIUM | NO |

### Additional Features from Synth MCP Tool Analysis

After examining the live Synth MCP tools, several additional data sources are available that we are not yet leveraging:

**1. Polymarket Up/Down Comparison (synth_insight_polymarket_up_down_daily)**
- Live data confirmed working for SPY. Returns both Synth probability and Polymarket probability.
- Example live data: SPY has Synth probability_up = 1.0 while Polymarket probability_up = 0.42, showing massive divergence.
- **Recommendation:** Add a "Synth vs Market" panel showing where Synth disagrees with prediction markets. This is a strong "Innovation" signal for judges.
- **Effort:** 1 hour (proxy endpoint + frontend card)

**2. LP Bounds / Range Analysis (synth_insight_liquidity_provision)**
- Already proxied via `/api/insights/lp-bounds`.
- Live data shows SPY 1% range has 73.2% probability of staying within, 2% range has 99.4%.
- Could be displayed as a "Range Probability" widget on the asset detail page.

**3. Price Probability Up/Down (synth_insight_price_probability_up_down)**
- Returns probability of hitting 11 upside and 11 downside price targets.
- Could power a "price target probability ladder" visualization.
- **Effort:** 1 hour for backend proxy + frontend display.

**4. Liquidation Probabilities (synth_insight_liquidation_probabilities)**
- Already proxied. Returns probabilities across 6h/12h/18h/24h windows at 1-10% price change levels.
- Live SPY data shows extremely low liquidation risk (0.0014 at 1% for 24h longs).

### Criteria Gap Analysis

| Criterion | Weight | Current Score | Gap | How to Close |
|-----------|--------|---------------|-----|-------------|
| Technical Implementation | 30% | 8/10 | Small | Already strong: FastAPI + Redis + TanStack Query + D3 + TradingView |
| Probabilistic Modeling | 30% | 9/10 | Minimal | Distribution analysis, vol term structure, Kelly all use distributions well |
| Practical Market Relevance | 25% | 6/10 | **MEDIUM** | Smart SL/TP + equity screener + Polymarket comparison would close this |
| Innovation | 15% | 7/10 | Small | Pairs divergence + regime detection + Synth vs Polymarket edge finder |

**The biggest scoring gap is Practical Market Relevance.** Smart SL/TP levels and the equity screener directly address this.

---

## Research 2: API Cost Optimization

### Current State Analysis

**Current configuration (from `config.py`):**
- `SYNTH_POLL_INTERVAL_SECONDS = 300` (5 minutes)
- `SYNTH_CACHE_TTL_SECONDS = 600` (10 minutes)
- Polling loop: 24h for all 9 assets every cycle, 1h every 3rd cycle

**Current credit consumption:**
```
24h polls: 9 assets x 12 cycles/hr = 108 credits/hr
1h polls:  9 assets x 4 cycles/hr  =  36 credits/hr
Total:     144 credits/hr = 3,456 credits/day
Monthly:   ~103,680 credits (exceeds 20K limit by 5x)
```

This is already dramatically better than the original "~1000 credits/hour" concern but still exceeds the 20,000 monthly credit budget on a Professional plan.

### Synth API Update Frequency (From Documentation)

From the official docs (https://docs.synthdata.co):

| Horizon | Update Frequency | Timesteps | Timestep Interval |
|---------|-----------------|-----------|-------------------|
| 1h | Every 60 seconds | 61 | 1 minute |
| 24h | Every 300 seconds (5 min) | 289 | 5 minutes |

**Key insight:** The 24h forecast updates every 5 minutes, so polling more frequently than 5 minutes is wasted credits. The 1h forecast updates every 60 seconds, but for our use case (not HFT), polling every 5 minutes is sufficient.

### WebSocket vs REST Analysis

From the docs: "WebSocket pushes a new message approximately every 30 seconds, and each message counts against your credits."

**WebSocket cost per asset per hour:**
```
1 message / 30 seconds = 2 messages/min = 120 credits/hr per asset
9 assets = 1,080 credits/hr (WORSE than REST at 5-min polling!)
```

**REST at 5-min polling:**
```
12 calls/hr per asset x 9 assets = 108 credits/hr
```

**Verdict: REST with caching is dramatically more credit-efficient.** WebSocket is 10x more expensive for the same data. Only use WebSocket if you need sub-30-second latency, which we do not.

### Optimal Polling Strategy

#### Strategy 1: Differentiated Polling by Horizon (Recommended)

```
24h horizon: Poll every 5 min (matches update frequency)
1h horizon:  Poll every 5 min (slight delay vs 60s updates, but acceptable)
             OR on-demand only (user opens 1h view -> fetch + cache)
```

**Cost at 5-min polling, 24h only (default):**
```
9 assets x 12/hr = 108 credits/hr
108 x 24 x 30 = 77,760 credits/month (still over 20K)
```

#### Strategy 2: Reduced Asset Set (Smart Polling)

Not all 9 assets need the same polling frequency. Equities (SPY, NVDA, TSLA, AAPL, GOOGL) only trade during US market hours (9:30 AM - 4:00 PM ET, ~6.5 hours/day).

```python
import datetime

US_MARKET_OPEN = datetime.time(13, 30)   # 9:30 AM ET in UTC
US_MARKET_CLOSE = datetime.time(21, 0)   # 4:00 PM ET in UTC

ALWAYS_POLL = ["BTC", "ETH", "SOL", "XAU"]  # 24/7 assets
MARKET_HOURS_ONLY = ["SPY", "NVDA", "TSLA", "AAPL", "GOOGL"]

def should_poll(asset: str, now_utc: datetime.time) -> bool:
    if asset in ALWAYS_POLL:
        return True
    # Extended hours: poll 30 min before/after market
    extended_open = datetime.time(13, 0)
    extended_close = datetime.time(21, 30)
    return extended_open <= now_utc <= extended_close
```

**Cost with market-hours optimization:**
```
24/7 assets (4): 4 x 12/hr x 24hr = 1,152 credits/day
Market-hours assets (5): 5 x 12/hr x 7.5hr = 450 credits/day
Total: 1,602 credits/day = 48,060 credits/month (still over)
```

#### Strategy 3: Extended Polling Intervals (10 Minutes)

The 24h forecast has 289 timesteps at 5-minute intervals. Polling every 10 minutes means we miss one intermediate update, but the forecast shape barely changes in that window.

```
24h: Poll every 10 min = 6/hr
1h:  On-demand only (user opens asset detail)
```

**Cost:**
```
24/7 assets (4): 4 x 6/hr x 24hr = 576 credits/day
Market-hours (5): 5 x 6/hr x 7.5hr = 225 credits/day
Total: 801 credits/day = 24,030 credits/month (close to 20K limit)
```

#### Strategy 4: Aggressive Optimization (RECOMMENDED)

Combine all optimizations:

```
24h: Poll every 10 min for background cache
1h:  On-demand only (fetched when user views asset, cached for 5 min)
Equities: Only during extended US market hours
Weekend equities: Poll once every 30 min (low change expected)
```

**Cost breakdown:**
```
Weekday:
  Crypto + XAU (4 assets): 4 x 6/hr x 24hr = 576 credits/day
  Equities (5 assets): 5 x 6/hr x 7.5hr = 225 credits/day
  On-demand 1h calls: ~20/day estimate = 20 credits/day
  Weekday total: 821 credits/day

Weekend:
  Crypto + XAU (4 assets): 4 x 6/hr x 24hr = 576 credits/day
  Equities (5 assets): 5 x 2/hr x 24hr = 240 credits/day
  Weekend total: 816 credits/day

Monthly: 821 x 22 + 816 x 8 = 18,062 + 6,528 = 24,590 credits/month
```

Still slightly over. Final tweak: poll crypto every 15 min instead of 10:

```
Crypto + XAU (4 assets): 4 x 4/hr x 24hr = 384 credits/day
Equities (5 assets): 5 x 6/hr x 7.5hr = 225 credits/day
On-demand 1h: ~20/day
Weekday: 629 credits/day

Weekend:
Crypto + XAU: 384 credits/day
Equities: 5 x 2/hr x 24hr = 240 credits/day
Weekend: 624 credits/day

Monthly: 629 x 22 + 624 x 8 = 13,838 + 4,992 = 18,830 credits/month
```

This fits within the 20,000 monthly budget with margin.

### Implementation Recommendations

```python
# config.py additions
POLL_INTERVAL_24H_CRYPTO = 900     # 15 minutes
POLL_INTERVAL_24H_EQUITIES = 600   # 10 minutes during market hours
POLL_INTERVAL_24H_WEEKEND = 1800   # 30 minutes for equities on weekends
POLL_INTERVAL_1H = None            # On-demand only (no background poll)
```

### Change Detection Optimization

An additional optimization: compare the `forecast_start_time` from consecutive polls. If it has not changed, the underlying forecast has not been updated, so skip the derivation step (saves CPU, not credits).

```python
async def poll_with_change_detection(asset, horizon, api_key):
    data = await fetch_percentiles(asset, horizon, api_key)
    r = await get_redis()
    prev_start = await r.get(f"synth:start_time:{asset}:{horizon}")
    new_start = data.get("forecast_start_time")

    if prev_start == new_start:
        # Forecast unchanged, just refresh TTL
        await r.expire(f"synth:{asset}:{horizon}", settings.SYNTH_CACHE_TTL_SECONDS)
        await r.expire(f"derived:{asset}:{horizon}", settings.SYNTH_CACHE_TTL_SECONDS)
        return False  # no change

    await cache_synth_data(asset, horizon, data)
    await r.set(f"synth:start_time:{asset}:{horizon}", new_start)
    return True  # data changed
```

### Credit Budget Summary

| Strategy | Credits/Hour | Credits/Day | Credits/Month | Fits 20K? |
|----------|-------------|-------------|---------------|-----------|
| Current (5-min all) | 144 | 3,456 | 103,680 | No |
| WebSocket (all) | 1,080 | 25,920 | 777,600 | No |
| 10-min + market-hours | ~33 | 801 | 24,030 | Barely |
| **15-min crypto + 10-min equity + on-demand 1h** | **~26** | **~630** | **~18,830** | **Yes** |

---

## Research 3: Technical Performance Improvements

### Current Architecture Assessment

The backend (`backend/app/`) has a clean structure:
- **FastAPI** with async lifespan for background polling
- **httpx** with persistent client (connection pooling)
- **Redis** with `redis.asyncio` for async cache operations
- **Python derivations** in `core/derivations.py` (pure math, no NumPy)

### 3.1 Redis Connection Pooling

**Current state:** Single `aioredis.Redis` instance created lazily via `get_redis()`. This uses the default connection pool internally (redis-py creates a `ConnectionPool` by default with `from_url`).

**Issue:** The default pool size is 2^31 (effectively unlimited) but each connection is created on demand. For our workload (9 assets x 2 horizons = 18 keys), this is fine.

**Recommendation:** The current approach is adequate. Adding explicit `max_connections` would be premature optimization. However, one improvement:

```python
# Current: creates new client per call if None
# Better: use connection pool explicitly for more control
redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL, max_connections=10, decode_responses=True
)
redis_client = aioredis.Redis(connection_pool=redis_pool)
```

**Impact:** Negligible for our scale. Not worth implementing for hackathon.

### 3.2 Batch Redis Reads (MGET)

**Current state:** The `/api/analytics/derived/all` and `/api/synth/percentiles/all` endpoints loop through assets and make individual `GET` calls:

```python
for asset in ASSETS:
    data = await get_cached_derived(asset, horizon)  # individual GET
```

**Improvement:** Use `MGET` to fetch all keys in a single round trip:

```python
async def get_all_cached_derived(horizon: str) -> dict[str, dict]:
    r = await get_redis()
    keys = [f"derived:{asset}:{horizon}" for asset in ASSETS]
    values = await r.mget(keys)  # Single round trip
    results = {}
    for asset, raw in zip(ASSETS, values):
        if raw:
            results[asset] = json.loads(raw)
    return results
```

**Impact:** Reduces 9 Redis round trips to 1. At local Redis latency (~0.1ms), saves ~0.8ms per request. Marginal but clean improvement.

**Recommendation: Worth implementing.** It is a 5-minute change and makes the code cleaner.

### 3.3 orjson vs json

**Current state:** Uses stdlib `json` for all serialization/deserialization. Each Redis read/write involves `json.dumps()` / `json.loads()`.

**Performance comparison (typical benchmarks):**
```
json.dumps:  ~15 microseconds per call (small dict)
orjson.dumps: ~3 microseconds per call (5x faster)

json.loads:  ~12 microseconds per call
orjson.loads: ~4 microseconds per call (3x faster)
```

For our workload (9 assets x 2 horizons = 18 cache writes per poll cycle, ~50 reads/sec under load):
- Current: 18 x 15us = 270us per cycle (writes), ~600us/sec (reads)
- With orjson: 18 x 3us = 54us per cycle, ~200us/sec (reads)

**Savings: ~400 microseconds per second.** Irrelevant at our scale.

**Recommendation: Skip for hackathon.** The savings are microseconds. orjson also requires a C compiler for installation which can cause deployment issues.

### 3.4 NumPy Vectorized Operations vs Python Loops

**Current state:** `core/derivations.py` uses pure Python math. The derivation functions iterate over percentile dicts with ~9 entries (the 9 percentile levels).

**Analysis of key operations:**

1. `implied_vol()`: 3 dict lookups + 3 arithmetic ops. No loop.
2. `directional_probability()`: 5 dict lookups + comparisons. No loop.
3. `distribution_skew()`: 3 dict lookups + 2 arithmetic ops. No loop.
4. `detect_regime()`: Calls above functions + comparisons. No loop.
5. `kelly_from_synth()`: Sorts 9 items + linear interpolation. Tiny loop.
6. `liquidation_probability()`: Sorts 9 items + linear search. Tiny loop.

**NumPy overhead for 9-element arrays:**
```python
# NumPy has ~1-5 microsecond overhead per operation for small arrays
# For 9 elements, pure Python is actually FASTER than NumPy
import numpy as np
arr = np.array([1,2,3,4,5,6,7,8,9])  # ~2us creation overhead alone
```

**Recommendation: DO NOT use NumPy for derivations.** The current data is 9 percentile levels per timestep. NumPy has fixed overhead per operation that exceeds the computation time for arrays this small. NumPy would only help if we were vectorizing across all 289 timesteps simultaneously, which we currently do not need (we only use the last timestep).

**Exception:** If we add features that need full-path analysis (e.g., computing probability cones across all timesteps), NumPy becomes worthwhile:

```python
# For 289x9 matrix operations, NumPy IS faster
import numpy as np
all_percentiles = np.array([[ts[k] for k in sorted(ts.keys())]
                            for ts in data["forecast_future"]["percentiles"]])
# Shape: (289, 9) - NumPy shines here
returns = (all_percentiles - current_price) / current_price  # vectorized
```

### 3.5 Compute at Cache-Write vs Lazy Compute

**Current state:** Derivations are computed at cache-write time (in `cache_synth_data()`), stored in Redis as `derived:{asset}:{horizon}`.

**Pros of current approach (write-time computation):**
- Read latency is minimal (just Redis GET + json.loads)
- All endpoints serve pre-computed data
- No CPU spike during request handling

**Cons:**
- Computes derivations even if no one reads them
- Cannot customize derivations per request (e.g., different Kelly parameters)

**Alternative (lazy computation with TTL cache):**
```python
# Compute on first read, cache result
async def get_derived_lazy(asset, horizon):
    cached = await get_cached_derived(asset, horizon)
    if cached:
        return cached
    raw = await get_cached_synth(asset, horizon)
    if not raw:
        return None
    derived = compute_derived_metrics(raw, asset, horizon)
    await cache_derived(asset, horizon, derived)
    return derived
```

**Recommendation: Keep write-time computation (current approach).** The computation cost is trivial (~50 microseconds per asset) and pre-computing eliminates any latency variance on reads. For 9 assets x 2 horizons = 18 derivations per poll cycle, total computation is under 1 millisecond.

### 3.6 Memory Usage Analysis

**Redis memory for full dataset:**

```
Per asset per horizon:
  Raw percentiles: 289 timesteps x 9 percentiles x ~20 bytes per float = ~52 KB JSON
  Derived metrics: ~500 bytes JSON

Total: 9 assets x 2 horizons x (52 KB + 0.5 KB) = ~945 KB in Redis
```

**This is negligible.** Redis handles this trivially. No optimization needed.

### 3.7 Response Compression

**Current state:** No compression middleware. FastAPI responses are uncompressed JSON.

**Analysis of response sizes:**
```
/api/synth/percentiles (single asset, 24h):
  289 timesteps x 9 percentiles = ~52 KB uncompressed
  With gzip: ~8 KB (85% reduction)

/api/synth/percentiles/all (all assets, 24h):
  9 x 52 KB = ~468 KB uncompressed
  With gzip: ~45 KB (90% reduction)

/api/analytics/scanner:
  ~2 KB uncompressed (already small)
```

**Implementation:**
```python
from fastapi.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)  # compress responses > 1KB
```

**Recommendation: Add GZipMiddleware.** One line of code, significant reduction in bandwidth for the percentiles endpoints. The `/all` endpoint sends nearly 500KB uncompressed, which is noticeable on slower connections.

### 3.8 Additional Performance Recommendations

**httpx client reuse in insights.py:**
Currently, `insights.py` creates a new `httpx.AsyncClient` per request via `async with`:
```python
async def _synth_get(path, params, api_key):
    async with httpx.AsyncClient(timeout=30.0) as client:  # New client each time!
```

This should reuse the shared client from `synth_service.py`:
```python
from app.services.synth_service import _get_http_client

async def _synth_get(path, params, api_key):
    client = await _get_http_client()
    resp = await client.get(...)
```

**Impact:** Eliminates TCP connection setup overhead (~50-100ms per request to Synth API). This is the single highest-impact optimization in the codebase.

### Performance Priority Matrix

| Optimization | Effort | Impact | Priority |
|-------------|--------|--------|----------|
| Reuse httpx client in insights.py | 5 min | HIGH (50-100ms saved) | 1 |
| GZipMiddleware | 1 min | MEDIUM (bandwidth) | 2 |
| MGET for batch reads | 10 min | LOW (0.8ms saved) | 3 |
| Explicit Redis connection pool | 5 min | NEGLIGIBLE | Skip |
| orjson | 15 min | NEGLIGIBLE | Skip |
| NumPy vectorization | 30 min+ | NEGATIVE (slower for small arrays) | Skip |

---

## Research 4: Hyperliquid Trading Integration

### 4.1 hyperliquid-python-sdk Exchange Class

The official Python SDK provides the `Exchange` class for order placement. Key methods:

```python
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants
import eth_account

# Initialize with private key
account = eth_account.Account.from_key("0xPRIVATE_KEY")
info = Info(constants.MAINNET_API_URL, skip_ws=True)
exchange = Exchange(account, constants.MAINNET_API_URL)

# Market order (convenience method)
result = exchange.market_open(
    coin="ETH",       # Asset name
    is_buy=True,       # True for long, False for short
    sz=0.01,           # Size in asset units
    px=None,           # None for market order
    slippage=0.01,     # 1% slippage tolerance
)

# Limit order
from hyperliquid.utils.types import LIMIT_ORDER
result = exchange.order(
    coin="ETH",
    is_buy=True,
    sz=0.01,
    limit_px=3500.0,
    order_type={"limit": {"tif": "Gtc"}},  # Good til cancelled
)

# Close position
result = exchange.market_close(
    coin="ETH",
    sz=None,           # None = close entire position
    slippage=0.01,
)
```

### 4.2 Minimum Order Sizes

Minimum order value on Hyperliquid is approximately $10.25 USDC. The minimum size varies per asset based on `szDecimals`:

| Asset | Approximate Min Size | szDecimals | Min Notional |
|-------|---------------------|------------|--------------|
| BTC | 0.001 BTC | 5 | ~$71 |
| ETH | 0.01 ETH | 4 | ~$35 |
| SOL | 0.1 SOL | 2 | ~$20 |
| SPY | 0.01 units | 2 | ~$6.67 |
| NVDA | 0.01 units | 2 | ~depends on price |
| TSLA | 0.01 units | 2 | ~depends on price |
| AAPL | 0.01 units | 2 | ~depends on price |
| GOOGL | 0.01 units | 2 | ~depends on price |

The `szDecimals` for each asset can be queried from the exchange metadata:
```python
meta = info.meta()
for asset_info in meta["universe"]:
    print(asset_info["name"], asset_info["szDecimals"])
```

**With $5 USDC balance:** Cannot open any position on most assets (below $10.25 minimum). Would need at least $10.25 to place the smallest possible trade.

### 4.3 EIP-712 Signing

Hyperliquid uses EIP-712 typed data signing for all exchange operations. The SDK handles this internally:

1. The SDK constructs a "phantom agent" struct with the order parameters
2. Signs using EIP-712 with `chainId: 1337` (Hyperliquid L1, not Arbitrum)
3. Sends the signed payload to `https://api.hyperliquid.xyz/exchange`

**Important:** The signing chain ID is 1337 (Hyperliquid L1), NOT the Arbitrum chain ID. This causes issues with browser wallets that enforce chain matching. The SDK handles this transparently for server-side signing.

```python
# Internally, the SDK does:
from eth_account import Account
from eth_account.messages import encode_typed_data

phantom_agent = {
    "source": "a",   # "a" for mainnet
    "connectionId": hash_of_action,
}
# Signs with EIP-712 domain: {name: "Exchange", version: "1", chainId: 1337}
```

### 4.4 Server-Side vs Client-Side Signing

| Approach | Pros | Cons |
|----------|------|------|
| **Server-side (Python SDK)** | Simple, works immediately, full SDK support | Backend holds private key (security risk), user trusts server |
| **Client-side (browser wallet)** | User retains key custody, trustless | Chain ID mismatch (1337 vs connected chain), complex UX, requires TypeScript SDK |
| **API Wallet (agent)** | Best of both: user creates an "agent" wallet from their main wallet, gives it to backend | Extra setup step for user, but secure |

### 4.5 Fees

Hyperliquid fee structure (perpetuals):

| Tier | 14-Day Volume | Taker Fee | Maker Rebate |
|------|---------------|-----------|--------------|
| 0 | < $1M | 0.045% | -0.015% (rebate) |
| 1 | $1M - $5M | 0.040% | -0.017% |
| 2 | $5M - $25M | 0.035% | -0.019% |
| 3 | $25M - $100M | 0.030% | -0.020% |
| 4 | > $100M | 0.025% | -0.022% |

For the hackathon demo with a $5 test wallet:
- Market order taker fee: 0.045%
- On a $10 order: $0.0045 fee

### 4.6 TypeScript SDKs for Frontend

Two main community TypeScript SDKs exist:

**1. @nktkas/hyperliquid (Recommended)**
- npm: `@nktkas/hyperliquid`
- Works in browser environments
- Integrates with viem and ethers.js
- Supports MetaMask via `window.ethereum`

```typescript
import { WalletClient, HttpTransport } from "@nktkas/hyperliquid";

// With MetaMask (browser wallet)
const [account] = await window.ethereum.request({
  method: "eth_requestAccounts"
});
const walletClient = new WalletClient({
  wallet: window.ethereum,
  transport: new HttpTransport({ url: "https://api.hyperliquid.xyz" }),
});

// Place order
const result = await walletClient.order({
  orders: [{
    a: assetIndex,   // Asset index from meta
    b: true,          // is_buy
    p: "3500",        // limit price
    s: "0.01",        // size
    r: false,         // reduce_only
    t: { limit: { tif: "Ioc" } },  // Immediate or cancel (market order)
  }],
  grouping: "na",
});
```

**2. hyperliquid (nomeida)**
- npm: `hyperliquid`
- Provides UMD and ESM bundles
- Simpler API

**Browser wallet chain ID issue:**
Browser wallets enforce that the signing chain matches the connected chain. Hyperliquid requires signing with chainId 1337. The workaround:
1. Create an "agent wallet" on Hyperliquid (from settings)
2. The agent wallet signs server-side with chainId 1337
3. The browser wallet only approves the initial agent creation (one-time)

### 4.7 Recommended Hackathon Approach

**Simplest approach for demo: Server-side signing with API wallet**

```python
# Backend: app/services/hl_exchange.py
from hyperliquid.exchange import Exchange
from hyperliquid.info import Info
from hyperliquid.utils import constants
import eth_account

class HLTrader:
    def __init__(self, private_key: str):
        self.account = eth_account.Account.from_key(private_key)
        self.info = Info(constants.MAINNET_API_URL, skip_ws=True)
        self.exchange = Exchange(self.account, constants.MAINNET_API_URL)

    def market_buy(self, coin: str, size: float, slippage: float = 0.01):
        return self.exchange.market_open(coin, True, size, None, slippage)

    def market_sell(self, coin: str, size: float, slippage: float = 0.01):
        return self.exchange.market_open(coin, False, size, None, slippage)

    def close_position(self, coin: str, slippage: float = 0.01):
        return self.exchange.market_close(coin, None, None, slippage)

    def limit_order(self, coin: str, is_buy: bool, size: float, price: float):
        return self.exchange.order(
            coin, is_buy, size, price,
            order_type={"limit": {"tif": "Gtc"}},
        )
```

**API endpoint:**
```python
# Backend: app/routers/trading.py
@router.post("/trade/market")
async def place_market_order(
    coin: str,
    direction: str,  # "long" or "short"
    size: float,
    private_key: str = Header(..., alias="x-hl-private-key"),
):
    trader = HLTrader(private_key)
    is_buy = direction == "long"
    result = trader.market_buy(coin, size) if is_buy else trader.market_sell(coin, size)
    return {"data": result}
```

**Frontend flow:**
1. User enters private key (stored in browser memory only, never sent to backend storage)
2. Private key sent in request header per trade (HTTPS required)
3. Backend creates ephemeral Exchange instance, places order, returns result
4. Private key is never persisted server-side

### 4.8 Security Considerations

**Critical rules for the hackathon implementation:**

1. **NEVER store private keys in the database or Redis.** The key exists only in the request lifecycle.
2. **NEVER log private keys.** Ensure logging middleware does not capture the `x-hl-private-key` header.
3. **HTTPS is mandatory.** Private keys transit over the wire.
4. **Rate limit the trade endpoint.** Prevent abuse.
5. **Add confirmation step in UI.** Show order details before submission.
6. **Disclaimer:** "This is a hackathon demo. Do not use with significant funds."

**For production (post-hackathon):** Use Hyperliquid's agent wallet system. The user creates an agent wallet from the HL interface, provides only the agent's private key to SynthEdge, and can revoke it at any time from their main wallet.

### 4.9 Test Wallet Assessment

The provided test wallet:
- Balance: ~$5 USDC + $0.5 ETH on Arbitrum
- **Problem:** $5 USDC is below the minimum order size ($10.25) on most assets
- **Solution for demo:** Either add $5 more USDC, or use Hyperliquid testnet (`constants.TESTNET_API_URL`) which provides free test funds

```python
# Testnet for hackathon demo
exchange = Exchange(account, constants.TESTNET_API_URL)
info = Info(constants.TESTNET_API_URL, skip_ws=True)
```

**Recommendation:** Use testnet for the demo video. It demonstrates the same technical integration without requiring real funds.

### 4.10 Asset Mapping for Trading

Synth API uses different asset names than Hyperliquid for equities:

| Synth API Asset | Hyperliquid Perp | Pyth Oracle Feed |
|-----------------|-----------------|------------------|
| SPY | SPY | SPYX/USD |
| NVDA | NVDA | NVDAX/USD |
| TSLA | TSLA | TSLAX/USD |
| AAPL | AAPL | AAPLX/USD |
| GOOGL | GOOGL | GOOGLX/USD |
| BTC | BTC | BTC/USD |
| ETH | ETH | ETH/USD |
| SOL | SOL | SOL/USD |

The Synth prediction-percentiles endpoint uses: `SPY, NVDA, TSLA, AAPL, GOOGL` (without X suffix).
The Synth MCP tools also use: `SPY, NVDA, TSLA, AAPL, GOOGL` (without X suffix).
Pyth price feeds use the X suffix: `SPYX, NVDAX, TSLAX, AAPLX, GOOGLX`.

The existing `hl_service.py` mapping is correct -- Synth and HL use the same names for these assets.

---

## Summary of Actionable Recommendations

### Immediate (Next 2 Hours)

1. **Add Smart SL/TP endpoint** -- derive stop-loss and take-profit levels from percentile bands. High impact on "Practical Market Relevance" criterion.
2. **Add Equity Probabilistic Screener** -- rank the 5 equities by composite Synth-derived score. Directly relevant to "Best Equities Application" category.
3. **Fix httpx client reuse** in `insights.py` -- one-line change, 50-100ms latency improvement per insight request.
4. **Add GZipMiddleware** -- one-line change, 85-90% bandwidth reduction on large responses.

### Before Demo Submission

5. **Implement market-hours polling** for equities to reduce API credits from 144/hr to ~26/hr.
6. **Add pairs divergence detector** for equity pairs (NVDA/TSLA, AAPL/GOOGL).
7. **Add Synth vs Polymarket panel** showing probability divergences (free innovation points).

### Post-Hackathon

8. Switch to agent wallet system for Hyperliquid trading.
9. Add WebSocket for 1h horizon if real-time trading execution is needed.
10. Implement expected move tracker with historical prediction storage.
11. Add funding rate arbitrage dashboard.

---

## Sources

- Synth API Documentation: https://docs.synthdata.co
- Synth Credits and Pricing: https://docs.synthdata.co/getting-started/credits-and-pricing
- Synth WebSocket API: https://docs.synthdata.co/getting-started/websocket-api
- Synth Assets: https://docs.synthdata.co/getting-started/assets
- Synth Prediction Percentiles: https://docs.synthdata.co/prediction-percentiles
- Synth API Efficiency Guide: https://docs.synthdata.co (API_FEWER_CALLS.md local copy)
- Hyperliquid Exchange Endpoint: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
- Hyperliquid Python SDK: https://github.com/hyperliquid-dex/hyperliquid-python-sdk
- Hyperliquid Python SDK - Market Orders Example: https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/examples/basic_market_order.py
- Hyperliquid Fees: https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees
- Hyperliquid EIP-712 Signing: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
- Hyperliquid API Wallets: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/nonces-and-api-wallets
- @nktkas/hyperliquid TypeScript SDK: https://github.com/nktkas/hyperliquid
- nomeida/hyperliquid TypeScript SDK: https://github.com/nomeida/hyperliquid
- Hyperliquid Fee Optimization: https://onekey.so/blog/ecosystem/hyperliquid-fee-structure-how-to-optimize-trading-costs-45c553/
- Hyperliquid Tokenized Equities: https://thedefiant.io/news/defi/tokenized-equity-market-on-hyperliquid-heats-up
