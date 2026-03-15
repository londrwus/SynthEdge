"""Hyperliquid trading endpoints.

SECURITY MODEL:
- User provides their HL API wallet private key in the request body
- Key is used ONLY for that single request, never stored
- For the hackathon demo, we also support a configured test key
- In production, frontend would sign directly — this is a demo convenience

SUPPORTED OPERATIONS:
- Market open (buy/sell)
- Market close
- Limit order
- Cancel order
- Get open orders
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from eth_account import Account

from app.services.synth_service import get_cached_derived
from app.config import settings

logger = logging.getLogger("synthedge.trading")

router = APIRouter(prefix="/api/trading", tags=["trading"])

# Synth asset → HL trading name mapping
# Crypto = native perps (use coin name directly)
# Equities = HIP-3 spot markets (use ASSET/USDC format for SDK)
SYNTH_TO_HL_PERP = {
    "BTC": "BTC",
    "ETH": "ETH",
    "SOL": "SOL",
    "XAU": "PAXG",       # Gold perp (PAXG = gold-backed, tight spread)
    "SPY": "SPY/USDC",   # HIP-3 spot
    # NVDA: no active market pair on HL
    "TSLA": "TSLA/USDC", # HIP-3 spot
    "AAPL": "AAPL/USDC", # HIP-3 spot
    "GOOGL": "GOOGL/USDC", # HIP-3 spot
}

# Spot pair @-index names for HL raw API (L2 book, etc.)
# SDK accepts "TSLA/USDC" but the raw info API needs "@264"
SPOT_L2_NAMES: dict[str, str] = {}  # Populated lazily from spotMeta

# Minimum notional value in USD per asset (HL enforces ~$10 for most)
MIN_NOTIONAL_USD = 10.0

# Maximum leverage per asset class
MAX_LEVERAGE = {
    "BTC": 50, "ETH": 50, "SOL": 20, "XAU": 20,
    "SPY": 10, "TSLA": 5, "AAPL": 5, "GOOGL": 5,
}

# Size precision (decimal places) per asset
SIZE_DECIMALS = {
    "BTC": 5, "ETH": 4, "SOL": 2, "XAU": 3,
    "SPY": 4, "TSLA": 2, "AAPL": 2, "GOOGL": 2,
}


class MarketOrderRequest(BaseModel):
    asset: str
    is_buy: bool
    size: float
    leverage: int = 5
    private_key: Optional[str] = None
    account_address: Optional[str] = None
    slippage: float = 0.01


class LimitOrderRequest(BaseModel):
    asset: str
    is_buy: bool
    size: float
    price: float
    private_key: Optional[str] = None
    reduce_only: bool = False


class ClosePositionRequest(BaseModel):
    asset: str
    private_key: Optional[str] = None
    account_address: Optional[str] = None
    position_type: str = "perp"  # "perp" or "spot"
    size: Optional[float] = None  # Required for spot close


class CancelOrderRequest(BaseModel):
    asset: str
    order_id: int
    private_key: Optional[str] = None


class SmartOrderRequest(BaseModel):
    """Synth-powered smart order: uses percentile distribution for SL/TP."""
    asset: str
    is_buy: bool
    size: float
    private_key: Optional[str] = None
    account_address: Optional[str] = None
    tp_percentile: str = "0.8"
    sl_percentile: str = "0.2"
    horizon: str = "24h"


def _get_exchange(private_key: Optional[str] = None, account_address: Optional[str] = None):
    """Create Hyperliquid Exchange instance."""
    from hyperliquid.exchange import Exchange
    from hyperliquid.utils import constants

    key = private_key
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Private key required. Provide API wallet key in the trade panel."
        )

    # Validate key format
    if not key.startswith("0x") or len(key) != 66:
        raise HTTPException(
            status_code=400,
            detail="Invalid private key format. Must be a 0x-prefixed 64-character hex string. Create one at app.hyperliquid.xyz → Settings → API Wallet."
        )

    try:
        wallet = Account.from_key(key)
        if account_address:
            exchange = Exchange(wallet, constants.MAINNET_API_URL, account_address=account_address)
            return exchange, account_address
        else:
            exchange = Exchange(wallet, constants.MAINNET_API_URL)
            return exchange, wallet.address
    except Exception as e:
        logger.error(f"Exchange creation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid private key: {str(e)}")


def _validate_order(asset: str, size: float, leverage: int, current_price: float = 0):
    """Pre-validate order parameters before sending to Hyperliquid."""
    hl_asset = SYNTH_TO_HL_PERP.get(asset)
    if not hl_asset:
        raise HTTPException(status_code=400, detail=f"Asset {asset} not supported on Hyperliquid. Supported: {', '.join(SYNTH_TO_HL_PERP.keys())}")

    if size <= 0:
        raise HTTPException(status_code=400, detail="Size must be greater than 0.")

    # Validate leverage
    max_lev = MAX_LEVERAGE.get(asset, 20)
    if leverage < 1 or leverage > max_lev:
        raise HTTPException(status_code=400, detail=f"Leverage must be between 1x and {max_lev}x for {asset}.")

    # Check minimum notional if we have a price
    if current_price > 0:
        notional = size * current_price
        if notional < MIN_NOTIONAL_USD:
            raise HTTPException(
                status_code=400,
                detail=f"Order too small. Notional ${notional:.2f} is below Hyperliquid minimum of ${MIN_NOTIONAL_USD:.0f}. Increase size to at least {(MIN_NOTIONAL_USD / current_price):.6f} {asset}."
            )

    # Round size to valid precision
    decimals = SIZE_DECIMALS.get(asset, 4)
    rounded_size = round(size, decimals)
    if rounded_size <= 0:
        raise HTTPException(status_code=400, detail=f"Size too small. Minimum precision for {asset} is {decimals} decimal places.")

    return hl_asset, rounded_size


def _parse_hl_result(result: dict, asset: str, side: str) -> dict:
    """Parse the Hyperliquid SDK response and extract fill details or raise errors."""
    if not isinstance(result, dict):
        return {"raw": result}

    status = result.get("status")
    response = result.get("response")

    # HL returns {"status": "err", "response": "ErrorMessage"} on failure
    if status == "err":
        error_msg = str(response) if response else "Unknown error"

        # Map common HL errors to user-friendly messages
        error_map = {
            "InsufficientMargin": f"Insufficient margin. Deposit more USDC to your Hyperliquid account before trading {asset}.",
            "User or API Wallet does not exist": "API wallet not found. Make sure your API wallet is created and linked at app.hyperliquid.xyz → Settings.",
            "Unauthorized": "API wallet not authorized. Link it to your trading account at app.hyperliquid.xyz → Settings → API Wallet.",
            "Invalid API key": "Invalid API wallet key. Create a new one at app.hyperliquid.xyz → Settings → API Wallet.",
            "Order would immediately cross": f"Order rejected: price would cross the spread. Try a smaller slippage or different order type.",
            "Too many requests": "Rate limited by Hyperliquid. Wait a few seconds and try again.",
            "Asset not found": f"{asset} is not currently tradeable on Hyperliquid.",
        }

        # Check if any known error pattern matches
        friendly = None
        for pattern, msg in error_map.items():
            if pattern.lower() in error_msg.lower():
                friendly = msg
                break

        raise HTTPException(
            status_code=422,
            detail=friendly or f"Hyperliquid rejected the order: {error_msg}"
        )

    # Parse successful response
    parsed = {"raw_status": status}

    if isinstance(response, dict):
        resp_type = response.get("type")
        data = response.get("data")

        if resp_type == "order" and isinstance(data, dict):
            statuses = data.get("statuses", [])
            parsed["order_statuses"] = statuses

            # Check fill status
            if statuses:
                first_status = statuses[0]
                if isinstance(first_status, dict):
                    if "filled" in first_status:
                        fill_info = first_status["filled"]
                        parsed["filled"] = True
                        parsed["fill_price"] = fill_info.get("avgPx")
                        parsed["filled_size"] = fill_info.get("totalSz")
                        parsed["oid"] = fill_info.get("oid")
                    elif "resting" in first_status:
                        parsed["filled"] = False
                        parsed["resting"] = True
                        parsed["oid"] = first_status["resting"].get("oid")
                    elif "error" in first_status:
                        raise HTTPException(
                            status_code=422,
                            detail=f"Order error from Hyperliquid: {first_status['error']}"
                        )
                elif first_status == "filled":
                    parsed["filled"] = True
                elif first_status == "error":
                    raise HTTPException(status_code=422, detail="Order failed on Hyperliquid exchange.")

    return parsed


def _get_current_price(asset: str) -> float:
    """Try to get current price from HL info API."""
    try:
        from hyperliquid.info import Info
        from hyperliquid.utils import constants
        info = Info(constants.MAINNET_API_URL, skip_ws=True)
        all_mids = info.all_mids()
        hl_asset = SYNTH_TO_HL_PERP.get(asset, asset)
        price_str = all_mids.get(hl_asset)
        if price_str:
            return float(price_str)
    except Exception:
        pass
    return 0


# HIP-3 spot assets (no perp market, use spot pair for trading)
SPOT_ASSETS = {"SPY", "TSLA", "AAPL", "GOOGL"}


def _resolve_spot_l2_name(asset: str) -> str | None:
    """Resolve a Synth asset name to its HL spot pair @-index for L2 book queries.

    The SDK accepts 'TSLA/USDC' for orders, but the raw HL info API
    (L2 book, etc.) requires the '@{index}' format (e.g. '@264').
    """
    global SPOT_L2_NAMES
    if SPOT_L2_NAMES:
        return SPOT_L2_NAMES.get(asset)

    import requests
    try:
        resp = requests.post(
            "https://api.hyperliquid.xyz/info",
            json={"type": "spotMeta"},
            timeout=10,
        )
        meta = resp.json()
        tokens = {t["index"]: t["name"] for t in meta.get("tokens", []) if isinstance(t, dict)}

        for pair in meta.get("universe", []):
            pair_name = pair.get("name", "")
            pair_tokens = pair.get("tokens", [])
            if len(pair_tokens) >= 2 and isinstance(pair_tokens[0], int):
                base_name = tokens.get(pair_tokens[0], "")
                if base_name:
                    SPOT_L2_NAMES[base_name] = pair_name

        logger.info(f"Resolved {len(SPOT_L2_NAMES)} spot L2 names")
        return SPOT_L2_NAMES.get(asset)
    except Exception as e:
        logger.error(f"Failed to resolve spot L2 names: {e}")
        return None


def _get_l2_best_price(asset: str, is_buy: bool) -> tuple[float | None, float | None]:
    """Fetch L2 order book and return (best_price, spread_pct).

    For buy: returns best ask. For sell: returns best bid.
    Uses the @-index format that the HL raw API requires for spot pairs.
    """
    import requests

    # Resolve to @index format for spot assets
    l2_name = _resolve_spot_l2_name(asset) if asset in SPOT_ASSETS else asset
    if not l2_name:
        logger.error(f"Could not resolve L2 name for {asset}")
        return None, None

    try:
        resp = requests.post(
            "https://api.hyperliquid.xyz/info",
            json={"type": "l2Book", "coin": l2_name},
            timeout=10,
        )
        book = resp.json()
        levels = book.get("levels", [[], []])
        bids = levels[0] if len(levels) > 0 else []
        asks = levels[1] if len(levels) > 1 else []

        if not bids or not asks:
            return None, None

        best_bid = float(bids[0]["px"])
        best_ask = float(asks[0]["px"])
        mid = (best_bid + best_ask) / 2
        spread_pct = (best_ask - best_bid) / mid * 100 if mid else 0

        if is_buy:
            return best_ask, spread_pct
        else:
            return best_bid, spread_pct
    except Exception as e:
        logger.error(f"L2 book fetch failed for {asset} ({l2_name}): {e}")
    return None, None


@router.post("/market-order")
async def place_market_order(req: MarketOrderRequest):
    """Place a market order on Hyperliquid."""
    # Get current price for validation
    current_price = _get_current_price(req.asset)

    # Pre-validate
    hl_asset, size = _validate_order(req.asset, req.size, req.leverage, current_price)

    exchange, address = _get_exchange(req.private_key, req.account_address)
    side = "BUY" if req.is_buy else "SELL"
    is_spot = req.asset in SPOT_ASSETS

    try:
        if not is_spot:
            # Perp assets: standard market order (deep liquidity)
            exchange.update_leverage(req.leverage, hl_asset, is_cross=True)
            logger.info(f"Set leverage {req.leverage}x for {hl_asset}")

            result = exchange.market_open(
                hl_asset,
                is_buy=req.is_buy,
                sz=size,
                slippage=req.slippage,
            )
        else:
            # Spot/equity assets: fetch real ask/bid price from L2 book
            # because these markets have wide spreads and IoC fails
            best_price, spread_pct = _get_l2_best_price(req.asset, req.is_buy)
            if not best_price:
                raise HTTPException(
                    status_code=422,
                    detail=f"No {'asks' if req.is_buy else 'bids'} available for {req.asset} on Hyperliquid. The spot market may have no liquidity right now."
                )

            # Warn about extreme spreads (>10%)
            if spread_pct and spread_pct > 50:
                raise HTTPException(
                    status_code=422,
                    detail=f"{req.asset} spot market has an extreme spread ({spread_pct:.0f}%). Trading is not recommended — you would lose ~{spread_pct/2:.0f}% immediately. Wait for better liquidity."
                )

            # Add small slippage buffer to the real book price
            if req.is_buy:
                limit_px = round(best_price * (1 + 0.005), 2)
            else:
                limit_px = round(best_price * (1 - 0.005), 2)

            logger.info(f"Spot order: {hl_asset} {side} {size} @ limit {limit_px} (best={'ask' if req.is_buy else 'bid'} {best_price}, spread={spread_pct:.1f}%)")

            result = exchange.order(
                hl_asset,
                is_buy=req.is_buy,
                sz=size,
                limit_px=limit_px,
                order_type={"limit": {"tif": "Gtc"}},
                reduce_only=False,
            )

        logger.info(f"Order result: {req.asset} {side} {size} → {result}")

        # Parse HL response for fill details
        parsed = _parse_hl_result(result, req.asset, side)

        notional = size * (float(parsed.get("fill_price", 0)) or current_price or 0)
        margin = notional / req.leverage if req.leverage else notional

        return {
            "data": {
                "status": "filled" if parsed.get("filled") else "submitted",
                "asset": req.asset,
                "side": side,
                "size": size,
                "leverage": req.leverage,
                "fill_price": parsed.get("fill_price"),
                "filled_size": parsed.get("filled_size"),
                "notional": round(notional, 2) if notional else None,
                "margin_used": round(margin, 2) if margin else None,
                "order_id": parsed.get("oid"),
                "address": address,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Market order failed: {e}")
        error_str = str(e)

        # Try to extract meaningful error
        if "InsufficientMargin" in error_str or "insufficient" in error_str.lower():
            raise HTTPException(status_code=422, detail=f"Insufficient margin to {side} {size} {req.asset} at {req.leverage}x leverage. Deposit more USDC to your Hyperliquid account.")
        elif "does not exist" in error_str.lower():
            raise HTTPException(status_code=422, detail="API wallet not found on Hyperliquid. Create one at app.hyperliquid.xyz → Settings → API Wallet.")
        elif "unauthorized" in error_str.lower() or "not authorized" in error_str.lower():
            raise HTTPException(status_code=422, detail="API wallet not authorized for trading. Link it to your account at app.hyperliquid.xyz → Settings.")
        elif "too many" in error_str.lower() or "rate" in error_str.lower():
            raise HTTPException(status_code=429, detail="Rate limited by Hyperliquid. Wait a moment and try again.")
        else:
            raise HTTPException(status_code=500, detail=f"Trade execution failed: {error_str[:300]}")


@router.post("/limit-order")
async def place_limit_order(req: LimitOrderRequest):
    """Place a limit order on Hyperliquid."""
    hl_asset = SYNTH_TO_HL_PERP.get(req.asset)
    if not hl_asset:
        raise HTTPException(status_code=400, detail=f"Asset {req.asset} not supported")

    exchange, address = _get_exchange(req.private_key)

    try:
        result = exchange.order(
            hl_asset,
            is_buy=req.is_buy,
            sz=req.size,
            limit_px=req.price,
            order_type={"limit": {"tif": "Gtc"}},
            reduce_only=req.reduce_only,
        )

        parsed = _parse_hl_result(result, req.asset, "BUY" if req.is_buy else "SELL")

        return {
            "data": {
                "status": "filled" if parsed.get("filled") else "placed",
                "asset": req.asset,
                "side": "BUY" if req.is_buy else "SELL",
                "size": req.size,
                "price": req.price,
                "order_id": parsed.get("oid"),
                "address": address,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Limit order failed: {str(e)[:300]}")


@router.post("/close")
async def close_position(req: ClosePositionRequest):
    """Close an open position on Hyperliquid (perp or spot)."""
    hl_asset = SYNTH_TO_HL_PERP.get(req.asset)
    if not hl_asset:
        raise HTTPException(status_code=400, detail=f"Asset {req.asset} not supported")

    exchange, address = _get_exchange(req.private_key, req.account_address)

    try:
        if req.position_type == "spot":
            # Spot positions: sell the tokens via market sell order
            if not req.size or req.size <= 0:
                # Try to get size from spot balance
                from app.services.hl_service import get_spot_user_state, parse_spot_balances
                spot_state = get_spot_user_state(address)
                spot_positions = parse_spot_balances(spot_state)
                pos = next((p for p in spot_positions if p["asset"] == req.asset), None)
                if not pos or pos["size"] <= 0:
                    raise HTTPException(status_code=400, detail=f"No open spot position found for {req.asset}")
                close_size = pos["size"]
            else:
                close_size = req.size

            # Round size to valid precision for this asset
            decimals = SIZE_DECIMALS.get(req.asset, 4)
            close_size = round(close_size, decimals)

            # Sell the spot tokens via L2 book price (spot markets have wide spreads)
            best_bid, _ = _get_l2_best_price(req.asset, is_buy=False)
            if not best_bid:
                raise HTTPException(status_code=422, detail=f"No bids available for {req.asset}. Cannot close — spot market has no liquidity.")
            limit_px = round(best_bid * 0.995, 2)  # 0.5% below best bid
            result = exchange.order(
                hl_asset, is_buy=False, sz=close_size, limit_px=limit_px,
                order_type={"limit": {"tif": "Gtc"}}, reduce_only=False,
            )
            parsed = _parse_hl_result(result, req.asset, "SELL")
            return {"data": {"status": "closed", "asset": req.asset, "type": "spot", "size": close_size, "order_id": parsed.get("oid")}}
        else:
            # Perp positions: use market_close
            result = exchange.market_close(hl_asset)
            parsed = _parse_hl_result(result, req.asset, "CLOSE")
            return {"data": {"status": "closed", "asset": req.asset, "type": "perp", "order_id": parsed.get("oid")}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Close failed: {str(e)[:300]}")


@router.post("/cancel")
async def cancel_order(req: CancelOrderRequest):
    """Cancel an open order on Hyperliquid."""
    hl_asset = SYNTH_TO_HL_PERP.get(req.asset)
    if not hl_asset:
        raise HTTPException(status_code=400, detail=f"Asset {req.asset} not supported")

    exchange, address = _get_exchange(req.private_key)

    try:
        result = exchange.cancel(hl_asset, req.order_id)
        return {"data": {"status": "cancelled", "result": result}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cancel failed: {str(e)[:300]}")


@router.post("/smart-order")
async def place_smart_order(req: SmartOrderRequest):
    """
    Synth-powered smart order: uses probability distribution to set optimal SL/TP.

    For a LONG trade:
      - TP at the tp_percentile (default 80th = moderate upside target)
      - SL at the sl_percentile (default 20th = moderate downside protection)

    For a SHORT trade:
      - TP at the sl_percentile (default 20th = moderate downside target)
      - SL at the tp_percentile (default 80th = moderate upside protection)
    """
    from app.services.synth_service import get_cached_synth
    from app.core.derivations import get_last_percentiles

    raw_data = await get_cached_synth(req.asset, req.horizon)
    if not raw_data:
        raise HTTPException(status_code=404, detail=f"No Synth data for {req.asset}. Make sure the API is polling.")

    percentiles = get_last_percentiles(raw_data)
    current_price = raw_data.get("current_price", 0)

    # Pre-validate with current price from Synth data
    hl_asset, size = _validate_order(req.asset, req.size, 5, current_price)

    if req.is_buy:
        tp_price = percentiles.get(req.tp_percentile, current_price * 1.02)
        sl_price = percentiles.get(req.sl_percentile, current_price * 0.98)
    else:
        tp_price = percentiles.get(req.sl_percentile, current_price * 0.98)
        sl_price = percentiles.get(req.tp_percentile, current_price * 1.02)

    exchange, address = _get_exchange(req.private_key)
    side = "BUY" if req.is_buy else "SELL"
    is_spot = req.asset in SPOT_ASSETS

    try:
        # Place main order
        if not is_spot:
            main_result = exchange.market_open(
                hl_asset,
                is_buy=req.is_buy,
                sz=size,
                slippage=0.01,
            )
        else:
            # Spot: use L2 book price with GTC limit
            best_price, spread_pct = _get_l2_best_price(req.asset, req.is_buy)
            if not best_price:
                raise HTTPException(status_code=422, detail=f"No liquidity for {req.asset} on Hyperliquid spot market.")
            if spread_pct and spread_pct > 50:
                raise HTTPException(status_code=422, detail=f"{req.asset} spot market spread is {spread_pct:.0f}% — too wide to trade safely.")
            limit_px = round(best_price * (1 + 0.005) if req.is_buy else best_price * (1 - 0.005), 2)
            main_result = exchange.order(
                hl_asset, is_buy=req.is_buy, sz=size, limit_px=limit_px,
                order_type={"limit": {"tif": "Gtc"}}, reduce_only=False,
            )

        parsed = _parse_hl_result(main_result, req.asset, side)

        return {
            "data": {
                "status": "filled" if parsed.get("filled") else "smart_order_submitted",
                "asset": req.asset,
                "side": side,
                "size": size,
                "current_price": current_price,
                "fill_price": parsed.get("fill_price"),
                "synth_tp": round(tp_price, 2),
                "synth_sl": round(sl_price, 2),
                "tp_percentile": req.tp_percentile,
                "sl_percentile": req.sl_percentile,
                "order_id": parsed.get("oid"),
                "address": address,
                "note": "TP/SL derived from Synth probability distribution",
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Smart order failed: {e}")
        error_str = str(e)
        if "InsufficientMargin" in error_str or "insufficient" in error_str.lower():
            raise HTTPException(status_code=422, detail=f"Insufficient margin to {side} {size} {req.asset}. Deposit more USDC to your Hyperliquid account.")
        raise HTTPException(status_code=500, detail=f"Smart order failed: {error_str[:300]}")


@router.get("/open-orders")
async def get_open_orders(address: str):
    """Get open orders for an address (read-only, no private key needed)."""
    from hyperliquid.info import Info
    from hyperliquid.utils import constants

    try:
        info = Info(constants.MAINNET_API_URL, skip_ws=True)
        orders = info.open_orders(address)
        return {"data": {"orders": orders, "count": len(orders)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user-fills")
async def get_user_fills(address: str, limit: int = 20):
    """Get recent trade fills for an address."""
    from hyperliquid.info import Info
    from hyperliquid.utils import constants

    try:
        info = Info(constants.MAINNET_API_URL, skip_ws=True)
        fills = info.user_fills(address)
        return {"data": {"fills": fills[:limit], "total": len(fills)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
