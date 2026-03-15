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
    """Get user perp positions and margin from Hyperliquid."""
    try:
        info = get_info()
        state = info.user_state(address)
        return state
    except Exception as e:
        logger.error(f"HL user_state failed for {address}: {e}")
        return {"assetPositions": [], "marginSummary": {}}


def get_spot_user_state(address: str) -> dict:
    """Get user spot balances from Hyperliquid (HIP-3 assets like SPY, TSLA, etc.)."""
    try:
        info = get_info()
        # Use the raw API to query spot clearinghouse state
        spot_state = info.spot_user_state(address)
        return spot_state
    except AttributeError:
        # Older SDK versions may not have spot_user_state, use raw post
        try:
            info = get_info()
            spot_state = info.post("/info", {"type": "spotClearinghouseState", "user": address})
            return spot_state
        except Exception as e:
            logger.error(f"HL spot_user_state raw post failed for {address}: {e}")
            return {"balances": []}
    except Exception as e:
        logger.error(f"HL spot_user_state failed for {address}: {e}")
        return {"balances": []}


def get_all_mids() -> dict[str, str]:
    """Get all mid prices from Hyperliquid."""
    try:
        info = get_info()
        return info.all_mids()
    except Exception as e:
        logger.error(f"HL all_mids failed: {e}")
        return {}


def parse_positions(state: dict) -> list[dict]:
    """Parse HL user state into clean perp position objects."""
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
            "type": "perp",
        })
    return positions


def _get_spot_mid_prices() -> dict[str, float]:
    """Build a map of coin_name → mid_price for spot assets.

    HL spot pairs use @{index} keys in all_mids(). We resolve these
    by fetching spotMeta to map token names to their pair indices.
    """
    import requests

    try:
        # Get spot metadata to map token indices to names
        resp = requests.post(
            "https://api.hyperliquid.xyz/info",
            json={"type": "spotMeta"},
            timeout=10,
        )
        meta = resp.json()
        tokens = {t["index"]: t["name"] for t in meta.get("tokens", []) if isinstance(t, dict)}

        # Get all mid prices
        mids = get_all_mids()

        # Map each spot pair's base token name to its mid price
        coin_prices: dict[str, float] = {}
        for pair in meta.get("universe", []):
            pair_name = pair.get("name", "")
            pair_tokens = pair.get("tokens", [])
            if len(pair_tokens) >= 2 and isinstance(pair_tokens[0], int):
                base_token_idx = pair_tokens[0]
                base_name = tokens.get(base_token_idx, "")
                mid = mids.get(pair_name)
                if base_name and mid:
                    coin_prices[base_name] = float(mid)

        return coin_prices
    except Exception as e:
        logger.error(f"Failed to get spot mid prices: {e}")
        return {}


def parse_spot_balances(spot_state: dict, mids: dict[str, float] | None = None) -> list[dict]:
    """Parse HL spot clearinghouse state into position objects.

    HIP-3 assets (SPY, TSLA, etc.) show up as spot balances, not perp positions.
    """
    positions = []
    if mids is None:
        mids = _get_spot_mid_prices()

    for bal in spot_state.get("balances", []):
        coin = bal.get("coin", "")
        total = float(bal.get("total", "0"))
        if total == 0 or coin == "USDC":
            continue

        entry_ntl = float(bal.get("entryNtl", "0"))

        # Use HL-provided PnL if available (most accurate — uses mark price)
        hl_pnl = bal.get("unrealizedPnl")

        mid_price = mids.get(coin, 0)

        if hl_pnl is not None:
            # HL gave us the PnL directly — trust it
            unrealized_pnl = float(hl_pnl)
            current_ntl = entry_ntl + unrealized_pnl
        elif mid_price:
            current_ntl = total * mid_price
            unrealized_pnl = current_ntl - entry_ntl if entry_ntl else 0
        else:
            current_ntl = entry_ntl
            unrealized_pnl = 0

        synth_asset = HL_TO_SYNTH.get(coin, coin)

        positions.append({
            "asset": coin,
            "synth_asset": synth_asset,
            "direction": "long",
            "size": total,
            "entry_price": round(entry_ntl / total, 4) if total else 0,
            "current_price": round(mid_price, 4) if mid_price else None,
            "leverage": 1.0,
            "liquidation_price": None,
            "unrealized_pnl": round(unrealized_pnl, 2),
            "unrealized_pnl_pct": round(unrealized_pnl / max(entry_ntl, 0.01) * 100, 2) if entry_ntl else 0,
            "notional": round(current_ntl, 2),
            "type": "spot",
        })

    return positions


def get_margin_summary(state: dict) -> dict:
    ms = state.get("marginSummary", {})
    return {
        "account_value": float(ms.get("accountValue", "0")),
        "total_margin_used": float(ms.get("totalMarginUsed", "0")),
        "total_ntl_pos": float(ms.get("totalNtlPos", "0")),
    }
