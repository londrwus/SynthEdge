"""Portfolio endpoints — Hyperliquid positions enriched with Synth data."""

from fastapi import APIRouter, Query
from app.services.hl_service import get_user_state, parse_positions, get_margin_summary
from app.services.synth_service import get_cached_derived, get_cached_synth
from app.core.derivations import get_last_percentiles, liquidation_probability
from app.services.hl_service import HL_TO_SYNTH

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/positions")
async def get_positions(address: str = Query(...), horizon: str = Query("24h")):
    state = get_user_state(address)
    positions = parse_positions(state)
    margin = get_margin_summary(state)

    # Enrich with Synth data
    enriched = []
    for pos in positions:
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
    state = get_user_state(address)
    positions = parse_positions(state)
    margin = get_margin_summary(state)

    total_pnl = sum(p["unrealized_pnl"] for p in positions)
    total_notional = sum(p["notional"] for p in positions)

    return {
        "data": {
            "account_value": margin["account_value"],
            "total_margin_used": margin["total_margin_used"],
            "total_notional": total_notional,
            "total_unrealized_pnl": total_pnl,
            "position_count": len(positions),
        }
    }
