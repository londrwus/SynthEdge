# SKILL: Real-Time Data — Polling Architecture (No WebSocket)

## Overview
Simple: Backend polls Synth → Redis. Frontend polls Backend → TanStack Query cache. No WebSocket.

## Backend: Synth Polling Loop

```python
# app/services/synth_poller.py
import asyncio
import httpx
import json
import redis.asyncio as redis
from app.config import settings
from app.core.derivations import compute_derived_metrics

ASSETS = ["BTC", "ETH", "SOL", "XAU", "SPYX", "NVDAX", "TSLAX", "AAPLX", "GOOGLX"]
HORIZONS = ["1h", "24h"]

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def synth_polling_loop():
    """Runs as asyncio background task in FastAPI lifespan."""
    while True:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for asset in ASSETS:
                for horizon in HORIZONS:
                    try:
                        resp = await client.get(
                            f"https://api.synthdata.co/insights/prediction-percentiles",
                            params={"asset": asset, "horizon": horizon},
                            headers={"Authorization": f"Apikey {settings.SYNTH_API_KEY}"}
                        )
                        resp.raise_for_status()
                        data = resp.json()

                        # Cache raw response
                        await redis_client.setex(
                            f"synth:{asset}:{horizon}",
                            settings.SYNTH_CACHE_TTL_SECONDS,
                            json.dumps(data)
                        )

                        # Compute and cache derived metrics
                        derived = compute_derived_metrics(data, asset, horizon)
                        await redis_client.setex(
                            f"derived:{asset}:{horizon}",
                            settings.SYNTH_CACHE_TTL_SECONDS,
                            json.dumps(derived)
                        )

                    except Exception as e:
                        # Log but don't crash — stale cache is better than no data
                        print(f"[Poller] Failed {asset}/{horizon}: {e}")

        await asyncio.sleep(settings.SYNTH_POLL_INTERVAL_SECONDS)
```

### FastAPI Lifespan
```python
# app/main.py
from contextlib import asynccontextmanager
import asyncio
from app.services.synth_poller import synth_polling_loop

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(synth_polling_loop())
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)
```

## Frontend: TanStack Query Polling

```typescript
// hooks/useSynthAll.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useSynthAll(horizon: string = '24h') {
  return useQuery({
    queryKey: ['synth', 'all', horizon],
    queryFn: () => api.get(`/api/synth/percentiles/all?horizon=${horizon}`),
    refetchInterval: 10_000,   // Frontend polls backend every 10 seconds
    staleTime: 5_000,          // Consider data stale after 5s
    gcTime: 60_000,            // Keep in cache for 60s
  })
}

export function useDerivedAll(horizon: string = '24h') {
  return useQuery({
    queryKey: ['derived', 'all', horizon],
    queryFn: () => api.get(`/api/analytics/derived/all?horizon=${horizon}`),
    refetchInterval: 10_000,
    staleTime: 5_000,
  })
}

export function usePortfolio(address: string | null) {
  return useQuery({
    queryKey: ['portfolio', address],
    queryFn: () => api.get(`/api/portfolio/positions?address=${address}`),
    enabled: !!address,
    refetchInterval: 15_000,   // Less frequent for positions
    staleTime: 10_000,
  })
}
```

## Data Flow

```
Synth API (polled every 60s by backend)
    ↓
Redis cache (TTL=55s)
    ↓
Backend endpoints (read from Redis, return to frontend)
    ↓
TanStack Query (frontend polls every 10s, auto-caches)
    ↓
React components (re-render on data change)
```

This is simple, debuggable, and works. No WebSocket state management, no reconnection logic, no message protocol. If the demo works → ship it.
