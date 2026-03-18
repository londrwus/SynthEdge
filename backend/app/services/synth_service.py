"""Synth API client and polling service.

CREDIT OPTIMIZATION:
- Default poll interval: 5 minutes (configurable via settings)
- Only poll 24h by default (1h on-demand or every 3rd cycle)
- Redis TTL: 10 minutes (survives between polls)
- Connection pooling via shared httpx client
- Mock data saved once per session
- Force-refresh endpoint for manual updates

Cost estimate at 5-min polling:
  9 assets × 1 call × 12/hr = 108 credits/hr
  + 9 assets × 1h every 3rd cycle = 36 credits/hr
  Total: ~144 credits/hr = 3,456 credits/day
"""

import asyncio
import json
import logging
import time
from pathlib import Path

import httpx
import redis.asyncio as aioredis

from app.config import settings
from app.core.derivations import ASSETS, compute_derived_metrics

logger = logging.getLogger("synthedge.synth")

MOCK_DIR = Path(__file__).parent.parent.parent / "mock_data"

redis_client: aioredis.Redis | None = None
_http_client: httpx.AsyncClient | None = None
_mock_saved: set[str] = set()
_last_poll_time: float = 0
_poll_count: int = 0


async def get_redis() -> aioredis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_client


async def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=30.0)
    return _http_client


async def fetch_percentiles(asset: str, horizon: str, api_key: str) -> dict:
    """Fetch prediction percentiles from Synth API with mock fallback."""
    try:
        client = await _get_http_client()
        resp = await client.get(
            f"{settings.SYNTH_API_BASE}/insights/prediction-percentiles",
            params={"asset": asset, "horizon": horizon},
            headers={"Authorization": f"Apikey {api_key}"},
        )
        resp.raise_for_status()
        data = resp.json()

        # Save mock data once per session
        mock_key = f"{asset}_{horizon}"
        if settings.SAVE_MOCK_DATA and mock_key not in _mock_saved:
            mock_file = MOCK_DIR / f"{mock_key}.json"
            mock_file.parent.mkdir(parents=True, exist_ok=True)
            mock_file.write_text(json.dumps(data))
            _mock_saved.add(mock_key)

        return data
    except Exception as e:
        logger.warning(f"Synth API failed for {asset}/{horizon}: {e}, trying mock")
        mock_file = MOCK_DIR / f"{asset}_{horizon}.json"
        if mock_file.exists():
            return json.loads(mock_file.read_text())
        raise


async def cache_synth_data(asset: str, horizon: str, data: dict):
    """Cache raw percentiles and derived metrics in Redis."""
    r = await get_redis()
    ttl = settings.SYNTH_CACHE_TTL_SECONDS

    pipe = r.pipeline()
    pipe.setex(f"synth:{asset}:{horizon}", ttl, json.dumps(data))

    derived = compute_derived_metrics(data, asset, horizon)
    pipe.setex(f"derived:{asset}:{horizon}", ttl, json.dumps(derived))

    # Store last update timestamp
    pipe.set("synth:last_update", str(time.time()))
    await pipe.execute()


async def get_cached_synth(asset: str, horizon: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(f"synth:{asset}:{horizon}")
    return json.loads(raw) if raw else None


async def get_cached_derived(asset: str, horizon: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(f"derived:{asset}:{horizon}")
    return json.loads(raw) if raw else None


async def get_poll_status() -> dict:
    """Get current polling status for frontend display."""
    r = await get_redis()
    last_update = await r.get("synth:last_update")
    return {
        "last_update": float(last_update) if last_update else None,
        "poll_count": _poll_count,
        "poll_interval_seconds": settings.SYNTH_POLL_INTERVAL_SECONDS,
        "cache_ttl_seconds": settings.SYNTH_CACHE_TTL_SECONDS,
        "credits_per_hour_estimate": (
            len(ASSETS) * (3600 / settings.SYNTH_POLL_INTERVAL_SECONDS)  # 24h polls
            + len(ASSETS) * (3600 / settings.SYNTH_POLL_INTERVAL_SECONDS) / 3  # 1h polls (every 3rd)
        ),
    }


async def force_refresh_all(api_key: str | None = None) -> dict:
    """Force-refresh all assets. Requires explicit API key — env key reserved for polling."""
    key = api_key
    if not key:
        return {"error": "no_api_key", "refreshed": 0}

    # Equities don't support 1h on Synth API
    EQUITY_ONLY_24H = {"SPY", "NVDA", "TSLA", "AAPL", "GOOGL"}

    refreshed = 0
    for asset in ASSETS:
        horizons = ["24h"] if asset in EQUITY_ONLY_24H else ["24h", "1h"]
        for horizon in horizons:
            try:
                data = await fetch_percentiles(asset, horizon, key)
                await cache_synth_data(asset, horizon, data)
                refreshed += 1
            except Exception as e:
                logger.error(f"Force refresh failed {asset}/{horizon}: {e}")
            await asyncio.sleep(0.2)

    return {"refreshed": refreshed, "total": len(ASSETS) * 2}


async def synth_polling_loop():
    """Background task: poll Synth API on configurable interval.

    Default: 5-minute intervals
    - Every cycle: poll 24h for all 9 assets (9 API calls)
    - Every 3rd cycle: also poll 1h for all 9 assets (+9 API calls)
    - Total: ~144 credits/hour at 5-min intervals
    """
    global _poll_count, _last_poll_time

    api_key = settings.SYNTH_API_KEY
    if not api_key:
        logger.warning("No SYNTH_API_KEY set, loading from mock data")
        # Load mock data once
        for asset in ASSETS:
            for horizon in ["24h", "1h"]:
                mock_file = MOCK_DIR / f"{asset}_{horizon}.json"
                if mock_file.exists():
                    data = json.loads(mock_file.read_text())
                    await cache_synth_data(asset, horizon, data)
        logger.info("Mock data loaded into cache")
        # Keep running to maintain cache TTL
        while True:
            for asset in ASSETS:
                for horizon in ["24h", "1h"]:
                    mock_file = MOCK_DIR / f"{asset}_{horizon}.json"
                    if mock_file.exists():
                        data = json.loads(mock_file.read_text())
                        await cache_synth_data(asset, horizon, data)
            await asyncio.sleep(settings.SYNTH_CACHE_TTL_SECONDS - 10)

    # Real API polling
    while True:
        _poll_count += 1
        _last_poll_time = time.time()

        # Always poll 24h
        for asset in ASSETS:
            try:
                data = await fetch_percentiles(asset, "24h", api_key)
                await cache_synth_data(asset, "24h", data)
            except Exception as e:
                logger.error(f"Poll failed {asset}/24h: {e}")
            await asyncio.sleep(0.3)

        # Poll 1h every 3rd cycle (only crypto + XAU — equities don't support 1h)
        SUPPORTS_1H = {"BTC", "ETH", "SOL", "XAU"}
        if _poll_count % 3 == 0:
            for asset in ASSETS:
                if asset not in SUPPORTS_1H:
                    continue
                try:
                    data = await fetch_percentiles(asset, "1h", api_key)
                    await cache_synth_data(asset, "1h", data)
                except Exception as e:
                    logger.error(f"Poll failed {asset}/1h: {e}")
                await asyncio.sleep(0.3)

        logger.info(
            f"Poll #{_poll_count} complete "
            f"(24h: {len(ASSETS)}, 1h: {len(ASSETS) if _poll_count % 3 == 0 else 0})"
        )
        await asyncio.sleep(settings.SYNTH_POLL_INTERVAL_SECONDS)
