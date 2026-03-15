"""Hyperliquid read-only service."""

import logging
from hyperliquid.info import Info
from hyperliquid.utils import constants

logger = logging.getLogger("synthedge.hl")

# Synth asset → HL perp mapping
SYNTH_TO_HL = {
    "BTC": "BTC",
    "ETH": "ETH",
    "SOL": "SOL",
    "XAU": "XAU",
    "SPY": "SPY",
    "NVDA": "NVDA",
    "TSLA": "TSLA",
    "AAPL": "AAPL",
    "GOOGL": "GOOGL",
}

HL_TO_SYNTH = {v: k for k, v in SYNTH_TO_HL.items()}


def get_info() -> Info:
    return Info(constants.MAINNET_API_URL, skip_ws=True)


def get_user_state(address: str) -> dict:
    """Get user positions and margin from Hyperliquid."""
    try:
        info = get_info()
        state = info.user_state(address)
        return state
    except Exception as e:
        logger.error(f"HL user_state failed for {address}: {e}")
        return {"assetPositions": [], "marginSummary": {}}


def get_all_mids() -> dict[str, str]:
    """Get all mid prices from Hyperliquid."""
    try:
        info = get_info()
        return info.all_mids()
    except Exception as e:
        logger.error(f"HL all_mids failed: {e}")
        return {}


def parse_positions(state: dict) -> list[dict]:
    """Parse HL user state into clean position objects."""
    positions = []
    for ap in state.get("assetPositions", []):
        pos = ap.get("position", {})
        coin = pos.get("coin", "")
        szi = float(pos.get("szi", "0"))
        if szi == 0:
            continue

        entry_px = float(pos.get("entryPx", "0"))
        liq_px = pos.get("liquidationPx")
        leverage_val = pos.get("leverage", {})
        if isinstance(leverage_val, dict):
            lev = float(leverage_val.get("value", "1"))
        else:
            lev = float(leverage_val) if leverage_val else 1.0

        unrealized_pnl = float(pos.get("unrealizedPnl", "0"))
        notional = abs(szi * entry_px)

        positions.append({
            "asset": coin,
            "synth_asset": HL_TO_SYNTH.get(coin, coin),
            "direction": "long" if szi > 0 else "short",
            "size": abs(szi),
            "entry_price": entry_px,
            "leverage": lev,
            "liquidation_price": float(liq_px) if liq_px else None,
            "unrealized_pnl": unrealized_pnl,
            "unrealized_pnl_pct": round(unrealized_pnl / max(notional, 0.01) * 100, 2),
            "notional": notional,
        })
    return positions


def get_margin_summary(state: dict) -> dict:
    ms = state.get("marginSummary", {})
    return {
        "account_value": float(ms.get("accountValue", "0")),
        "total_margin_used": float(ms.get("totalMarginUsed", "0")),
        "total_ntl_pos": float(ms.get("totalNtlPos", "0")),
    }
