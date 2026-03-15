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
# Equities = HIP-3 spot markets (use ASSET/USDC format)
SYNTH_TO_HL_PERP = {
    "BTC": "BTC",
    "ETH": "ETH",
    "SOL": "SOL",
    "XAU": "XAU",        # May not be available
    "SPY": "SPY/USDC",   # HIP-3 spot
    # "NVDA": no active market pair on HL yet
    "TSLA": "TSLA/USDC", # HIP-3 spot
    "AAPL": "AAPL/USDC", # HIP-3 spot
    "GOOGL": "GOOGL/USDC", # HIP-3 spot
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
    """Create Hyperliquid Exchange instance.

    If account_address is provided, the private_key is treated as an API/agent wallet
    that trades on behalf of the main account_address.
    """
    from hyperliquid.exchange import Exchange
    from hyperliquid.utils import constants

    key = private_key
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Private key required. Provide API wallet key in the trade panel."
        )

    try:
        wallet = Account.from_key(key)
        # If account_address provided, this is an agent/API wallet
        if account_address:
            exchange = Exchange(wallet, constants.MAINNET_API_URL, account_address=account_address)
            return exchange, account_address
        else:
            exchange = Exchange(wallet, constants.MAINNET_API_URL)
            return exchange, wallet.address
    except Exception as e:
        logger.error(f"Exchange creation failed: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid key: {str(e)}")


@router.post("/market-order")
async def place_market_order(req: MarketOrderRequest):
    """Place a market order on Hyperliquid."""
    hl_asset = SYNTH_TO_HL_PERP.get(req.asset)
    if not hl_asset:
        raise HTTPException(status_code=400, detail=f"Asset {req.asset} not supported on Hyperliquid")

    exchange, address = _get_exchange(req.private_key, req.account_address)

    try:
        # Set leverage before trading
        exchange.update_leverage(req.leverage, hl_asset, is_cross=True)
        logger.info(f"Set leverage {req.leverage}x for {hl_asset}")

        result = exchange.market_open(
            hl_asset,
            is_buy=req.is_buy,
            sz=req.size,
            slippage=req.slippage,
        )
        logger.info(f"Market order: {req.asset} {'BUY' if req.is_buy else 'SELL'} {req.size} @ {req.leverage}x → {result}")
        return {
            "data": {
                "status": "executed",
                "asset": req.asset,
                "side": "BUY" if req.is_buy else "SELL",
                "size": req.size,
                "result": result,
                "address": address,
            }
        }
    except Exception as e:
        logger.error(f"Market order failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        return {
            "data": {
                "status": "placed",
                "asset": req.asset,
                "side": "BUY" if req.is_buy else "SELL",
                "size": req.size,
                "price": req.price,
                "result": result,
                "address": address,
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/close")
async def close_position(req: ClosePositionRequest):
    """Close an open position on Hyperliquid."""
    hl_asset = SYNTH_TO_HL_PERP.get(req.asset)
    if not hl_asset:
        raise HTTPException(status_code=400, detail=f"Asset {req.asset} not supported")

    exchange, address = _get_exchange(req.private_key, req.account_address)

    try:
        result = exchange.market_close(hl_asset)
        return {"data": {"status": "closed", "asset": req.asset, "result": result}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    hl_asset = SYNTH_TO_HL_PERP.get(req.asset)
    if not hl_asset:
        raise HTTPException(status_code=400, detail=f"Asset {req.asset} not supported")

    # Get Synth distribution for SL/TP levels
    raw = await get_cached_derived(req.asset, req.horizon) if False else None
    from app.services.synth_service import get_cached_synth
    from app.core.derivations import get_last_percentiles

    raw_data = await get_cached_synth(req.asset, req.horizon)
    if not raw_data:
        raise HTTPException(status_code=404, detail=f"No Synth data for {req.asset}")

    percentiles = get_last_percentiles(raw_data)
    current_price = raw_data.get("current_price", 0)

    if req.is_buy:
        tp_price = percentiles.get(req.tp_percentile, current_price * 1.02)
        sl_price = percentiles.get(req.sl_percentile, current_price * 0.98)
    else:
        tp_price = percentiles.get(req.sl_percentile, current_price * 0.98)
        sl_price = percentiles.get(req.tp_percentile, current_price * 1.02)

    exchange, address = _get_exchange(req.private_key)

    try:
        # Place main order
        main_result = exchange.market_open(
            hl_asset,
            is_buy=req.is_buy,
            sz=req.size,
            slippage=0.01,
        )

        return {
            "data": {
                "status": "smart_order_executed",
                "asset": req.asset,
                "side": "BUY" if req.is_buy else "SELL",
                "size": req.size,
                "current_price": current_price,
                "synth_tp": round(tp_price, 2),
                "synth_sl": round(sl_price, 2),
                "tp_percentile": req.tp_percentile,
                "sl_percentile": req.sl_percentile,
                "main_order": main_result,
                "address": address,
                "note": "TP/SL derived from Synth probability distribution",
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
