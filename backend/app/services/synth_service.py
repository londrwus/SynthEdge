"""Synth API client and polling service.

Credit optimization strategy:
- Poll only 24h horizon every 60s (primary data, updates every 5min on Synth side)
- Poll 1h horizon every 120s (updates every 1min on Synth side, but we don't need every update)
- Use longer Redis TTL (120s) so data survives between polls
- Reuse httpx client across requests (connection pooling)
- Save to mock files only once (not every poll cycle)
"""

import asyncio
import json
import logging
import time
from pathlib import Path

import httpx
import redis.asyncio as aioredis

from app.config import settings
from app.core.derivations import ASSETS, HORIZONS, compute_derived_metrics

logger = logging.getLogger("synthedge.synth")

MOCK_DIR = Path(__file__).parent.parent.parent / "mock_data"

redis_client: aioredis.Redis | None = None

# Reusable HTTP client (connection pooling)
_http_client: httpx.AsyncClient | None = None

# Track if we've saved mock data this session (save once only)
_mock_saved: set[str] = set()


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

        # Save mock data once per session for fallback
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

    # Use pipeline for atomic writes
    pipe = r.pipeline()
    pipe.setex(f"synth:{asset}:{horizon}", ttl, json.dumps(data))

    derived = compute_derived_metrics(data, asset, horizon)
    pipe.setex(f"derived:{asset}:{horizon}", ttl, json.dumps(derived))
    await pipe.execute()


async def get_cached_synth(asset: str, horizon: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(f"synth:{asset}:{horizon}")
    return json.loads(raw) if raw else None


async def get_cached_derived(asset: str, horizon: str) -> dict | None:
    r = await get_redis()
    raw = await r.get(f"derived:{asset}:{horizon}")
    return json.loads(raw) if raw else None


async def synth_polling_loop():
    """Background task: poll Synth API for all assets/horizons.

    Credit optimization:
    - 24h: poll every 60s (9 assets = 9 credits/min = 540 credits/hr)
    - 1h: poll every 120s (9 assets = 4.5 credits/min = 270 credits/hr)
    - Total: ~810 credits/hr (down from 1080)
    - With staggering, spreads load evenly
    """
    api_key = settings.SYNTH_API_KEY
    if not api_key:
        logger.warning("No SYNTH_API_KEY set, polling from mock data only")

    poll_count = 0

    while True:
        poll_count += 1

        for asset in ASSETS:
            # Always poll 24h
            try:
                if api_key:
                    data = await fetch_percentiles(asset, "24h", api_key)
                else:
                    mock_file = MOCK_DIR / f"{asset}_24h.json"
                    if mock_file.exists():
                        data = json.loads(mock_file.read_text())
                    else:
                        continue
                await cache_synth_data(asset, "24h", data)
            except Exception as e:
                logger.error(f"Poll failed {asset}/24h: {e}")

            # Poll 1h every other cycle to save credits
            if poll_count % 2 == 0:
                try:
                    if api_key:
                        data = await fetch_percentiles(asset, "1h", api_key)
                    else:
                        mock_file = MOCK_DIR / f"{asset}_1h.json"
                        if mock_file.exists():
                            data = json.loads(mock_file.read_text())
                        else:
                            continue
                    await cache_synth_data(asset, "1h", data)
                except Exception as e:
                    logger.error(f"Poll failed {asset}/1h: {e}")

            # Small delay between assets to avoid rate limiting
            await asyncio.sleep(0.3)

        logger.info(f"Poll cycle {poll_count} complete ({len(ASSETS)} assets)")
        await asyncio.sleep(settings.SYNTH_POLL_INTERVAL_SECONDS)
