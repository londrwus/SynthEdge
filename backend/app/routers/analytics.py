"""Analytics endpoints — derived metrics, scanner, Kelly, liquidation risk."""

from fastapi import APIRouter, Query
from app.services.synth_service import get_cached_derived, get_cached_synth
from app.core.derivations import (
    ASSETS,
    kelly_from_synth,
    get_last_percentiles,
    liquidation_probability,
)
from app.models import KellyRequest

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/derived")
async def get_derived(asset: str = Query(...), horizon: str = Query("24h")):
    data = await get_cached_derived(asset, horizon)
    if not data:
        return {"error": "no_data", "asset": asset, "horizon": horizon}
    return {"data": data, "meta": {"cached": True}}


@router.get("/derived/all")
async def get_all_derived(horizon: str = Query("24h")):
    results = {}
    for asset in ASSETS:
        data = await get_cached_derived(asset, horizon)
        # Fallback to 24h for assets that don't support 1h
        if not data and horizon != "24h":
            data = await get_cached_derived(asset, "24h")
        if data:
            results[asset] = data
    return {"data": results, "meta": {"cached": True, "asset_count": len(results)}}


@router.get("/scanner")
async def get_scanner(horizon: str = Query("24h")):
    """Directional scanner — all assets with direction, probability, vol, regime.
    Falls back to 24h data if requested horizon isn't available for an asset."""
    scanner = []
    for asset in ASSETS:
        data = await get_cached_derived(asset, horizon)
        # Fallback to 24h if 1h not available (equities don't support 1h)
        fallback = False
        if (not data or "error" in data) and horizon != "24h":
            data = await get_cached_derived(asset, "24h")
            fallback = True
        if data and "error" not in data:
            scanner.append({
                "asset": data["asset"],
                "current_price": data["current_price"],
                "direction": data["direction"],
                "up_probability": data["up_probability"],
                "implied_vol": data["implied_vol_annualized"],
                "regime": data["regime"],
                "regime_description": data["regime_description"],
                "skew": data["skew"],
                "conviction": data["conviction"],
                "median_forecast": data["median_forecast"],
                "tail_risk": data["tail_risk"],
                "horizon_actual": "24h" if fallback else horizon,
            })
    # Sort by conviction descending
    scanner.sort(key=lambda x: x["conviction"], reverse=True)
    return {"data": scanner, "meta": {"count": len(scanner), "horizon": horizon}}


@router.post("/kelly")
async def calculate_kelly(req: KellyRequest):
    raw = await get_cached_synth(req.asset, req.horizon)
    if not raw:
        return {"error": "no_data", "asset": req.asset}

    p = get_last_percentiles(raw)
    current_price = raw.get("current_price", req.entry)

    result = kelly_from_synth(
        percentiles=p,
        current_price=current_price,
        entry_price=req.entry,
        take_profit=req.tp,
        stop_loss=req.sl,
        direction=req.direction,
        fraction=req.fraction,
    )
    result["asset"] = req.asset
    result["current_price"] = current_price
    return {"data": result}


@router.get("/liquidation-risk")
async def get_liquidation_risk(
    asset: str = Query(...),
    entry_price: float = Query(...),
    leverage: float = Query(...),
    direction: str = Query("long"),
    horizon: str = Query("24h"),
):
    raw = await get_cached_synth(asset, horizon)
    if not raw:
        return {"error": "no_data", "asset": asset}

    p = get_last_percentiles(raw)

    # Approximate liquidation price
    if direction == "long":
        liq_price = entry_price * (1 - 1 / leverage)
    else:
        liq_price = entry_price * (1 + 1 / leverage)

    prob = liquidation_probability(p, liq_price)

    return {
        "data": {
            "asset": asset,
            "entry_price": entry_price,
            "leverage": leverage,
            "direction": direction,
            "liquidation_price": round(liq_price, 2),
            "liquidation_probability": round(prob, 4),
            "horizon": horizon,
        }
    }
