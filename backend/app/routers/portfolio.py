"""Portfolio endpoints — Hyperliquid positions enriched with Synth data."""

import asyncio
from fastapi import APIRouter, Query
from app.services.hl_service import (
    get_user_state, parse_positions, get_margin_summary,
    get_spot_user_state, parse_spot_balances, HL_TO_SYNTH,
)
from app.services.synth_service import get_cached_derived, get_cached_synth
from app.core.derivations import get_last_percentiles, liquidation_probability

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/positions")
async def get_positions(address: str = Query(...), horizon: str = Query("24h")):
    # Fetch both perp and spot states in parallel (sync calls offloaded to thread pool)
    state, spot_state = await asyncio.gather(
        asyncio.to_thread(get_user_state, address),
        asyncio.to_thread(get_spot_user_state, address),
    )

    perp_positions = parse_positions(state)
    spot_positions = parse_spot_balances(spot_state)
    all_positions = perp_positions + spot_positions

    margin = get_margin_summary(state)

    # Add spot value to account total
    spot_value = sum(p["notional"] for p in spot_positions)
    margin["account_value"] += spot_value

    # Enrich with Synth data
    enriched = []
    for pos in all_positions:
        synth_asset = pos["synth_asset"]
        derived = await get_cached_derived(synth_asset, horizon)
        raw = await get_cached_synth(synth_asset, horizon)

        synth_data = {}
        if derived and "error" not in derived:
            synth_data["up_probability"] = derived["up_probability"]
            synth_data["direction"] = derived["direction"]
            synth_data["regime"] = derived["regime"]
            synth_data["implied_vol"] = derived["implied_vol_annualized"]
            synth_data["current_price"] = derived["current_price"]

        if raw and pos["liquidation_price"]:
            p = get_last_percentiles(raw)
            if p:
                synth_data["liquidation_risk"] = round(
                    liquidation_probability(p, pos["liquidation_price"]), 4
                )

        enriched.append({**pos, "synth": synth_data})

    return {
        "data": {
            "positions": enriched,
            "margin_summary": margin,
            "position_count": len(enriched),
        }
    }


@router.get("/summary")
async def get_summary(address: str = Query(...), horizon: str = Query("24h")):
    state, spot_state = await asyncio.gather(
        asyncio.to_thread(get_user_state, address),
        asyncio.to_thread(get_spot_user_state, address),
    )

    perp_positions = parse_positions(state)
    spot_positions = parse_spot_balances(spot_state)
    all_positions = perp_positions + spot_positions

    margin = get_margin_summary(state)

    spot_value = sum(p["notional"] for p in spot_positions)
    margin["account_value"] += spot_value

    total_pnl = sum(p["unrealized_pnl"] for p in all_positions)
    total_notional = sum(p["notional"] for p in all_positions)

    return {
        "data": {
            "account_value": margin["account_value"],
            "total_margin_used": margin["total_margin_used"],
            "total_notional": total_notional,
            "total_unrealized_pnl": total_pnl,
            "position_count": len(all_positions),
        }
    }
