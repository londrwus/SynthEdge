"""Synth data endpoints — cached percentiles and on-demand proxies."""

from typing import Optional
from fastapi import APIRouter, Header, Query
from app.services.synth_service import get_cached_synth, get_cached_derived, fetch_percentiles, cache_synth_data
from app.core.derivations import ASSETS

router = APIRouter(prefix="/api/synth", tags=["synth"])


def _resolve_api_key(header_key: Optional[str] = None) -> Optional[str]:
    """Use header key if provided. Never fall back to env var for user requests."""
    return header_key or None


@router.get("/percentiles")
async def get_percentiles(
    asset: str = Query(...),
    horizon: str = Query("24h"),
    x_synth_api_key: Optional[str] = Header(None),
):
    # Try cache first
    data = await get_cached_synth(asset, horizon)
    if data:
        return {"data": data, "meta": {"cached": True, "source": "redis"}}

    # Cache miss — try on-demand fetch if we have a key
    api_key = _resolve_api_key(x_synth_api_key)
    if api_key:
        try:
            data = await fetch_percentiles(asset, horizon, api_key)
            await cache_synth_data(asset, horizon, data)
            return {"data": data, "meta": {"cached": False, "source": "api"}}
        except Exception:
            pass

    return {"error": "no_data", "asset": asset, "horizon": horizon}


@router.get("/percentiles/all")
async def get_all_percentiles(
    horizon: str = Query("24h"),
    x_synth_api_key: Optional[str] = Header(None),
):
    results = {}
    for asset in ASSETS:
        data = await get_cached_synth(asset, horizon)
        if data:
            results[asset] = data
    return {"data": results, "meta": {"cached": True, "asset_count": len(results)}}
