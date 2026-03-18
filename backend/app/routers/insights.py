"""Deep Synth insight endpoints — options, volatility, liquidation, cross-asset analytics.
These proxy to dedicated Synth API endpoints for precision data (on-demand, not polled)."""

from typing import Optional
from fastapi import APIRouter, Header, Query, HTTPException
import httpx
import json

from app.config import settings
from app.services.synth_service import get_cached_synth, get_cached_derived
from app.core.derivations import ASSETS, get_last_percentiles, implied_vol, HORIZON_HOURS

router = APIRouter(prefix="/api/insights", tags=["insights"])


def _resolve_key(header_key: Optional[str] = None) -> str:
    """Use header key only. Never fall back to env var for user requests."""
    if not header_key:
        raise HTTPException(status_code=401, detail="No Synth API key provided. Enter your API key in settings.")
    return header_key


async def _synth_get(path: str, params: dict, api_key: str) -> dict:
    """Make authenticated GET to Synth API. Reuses connection pool."""
    from app.services.synth_service import _get_http_client
    client = await _get_http_client()
    resp = await client.get(
        f"{settings.SYNTH_API_BASE}{path}",
        params=params,
        headers={"Authorization": f"Apikey {api_key}"},
    )
    resp.raise_for_status()
    return resp.json()


# ─── OPTIONS PRICING (on-demand) ────────────────────────────────────────
@router.get("/options")
async def get_option_pricing(
    asset: str = Query(...),
    horizon: str = Query("24h"),
    x_synth_api_key: Optional[str] = Header(None),
):
    """Get Synth's Monte Carlo-derived option prices for calls/puts at multiple strikes."""
    api_key = _resolve_key(x_synth_api_key)
    try:
        data = await _synth_get(
            "/insights/option-pricing",
            {"asset": asset, "horizon": horizon},
            api_key,
        )
        # Enrich with computed greeks approximations
        current = data.get("current_price", 0)
        calls = data.get("call_options", {})
        puts = data.get("put_options", {})

        # Find ATM strike
        atm_strike = min(calls.keys(), key=lambda k: abs(float(k) - current)) if calls else None
        atm_call = calls.get(atm_strike, 0) if atm_strike else 0
        atm_put = puts.get(atm_strike, 0) if atm_strike else 0

        # Compute put-call parity check
        parity_diff = None
        if atm_strike:
            parity_diff = round(float(atm_call) - float(atm_put) - (current - float(atm_strike)), 4)

        return {
            "data": {
                **data,
                "analysis": {
                    "atm_strike": float(atm_strike) if atm_strike else None,
                    "atm_call_price": round(atm_call, 4),
                    "atm_put_price": round(atm_put, 4),
                    "put_call_parity_diff": parity_diff,
                    "num_strikes": len(calls),
                },
            }
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── LIQUIDATION PROBABILITIES (on-demand) ──────────────────────────────
@router.get("/liquidation")
async def get_liquidation_probs(
    asset: str = Query(...),
    horizon: str = Query("24h"),
    x_synth_api_key: Optional[str] = Header(None),
):
    """Get precise liquidation probabilities from Synth's 1000-path Monte Carlo."""
    api_key = _resolve_key(x_synth_api_key)
    try:
        data = await _synth_get(
            "/insights/liquidation",
            {"asset": asset, "horizon": horizon},
            api_key,
        )
        return {"data": data}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── LP BOUNDS / RANGE ANALYSIS (on-demand) ─────────────────────────────
@router.get("/lp-bounds")
async def get_lp_bounds(
    asset: str = Query(...),
    horizon: str = Query("24h"),
    x_synth_api_key: Optional[str] = Header(None),
):
    """Get LP interval analysis — probability of staying in range, expected IL."""
    api_key = _resolve_key(x_synth_api_key)
    try:
        data = await _synth_get(
            "/insights/lp-bounds",
            {"asset": asset, "horizon": horizon},
            api_key,
        )
        return {"data": data}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── CROSS-ASSET VOLATILITY ANALYSIS (derived) ─────────────────────────
@router.get("/cross-asset-vol")
async def get_cross_asset_vol():
    """
    Cross-asset volatility comparison — equities vs crypto vs commodities.
    Derived from cached percentiles. Shows vol term structure (1h vs 24h)
    and relative vol ranking across all assets.
    """
    results = []
    for asset in ASSETS:
        row = {"asset": asset}
        for horizon in ["1h", "24h"]:
            raw = await get_cached_synth(asset, horizon)
            if raw:
                p = get_last_percentiles(raw)
                current = raw.get("current_price", 0)
                if p and current:
                    vol = implied_vol(p, current, horizon)
                    row[f"vol_{horizon}"] = round(vol, 4)
                    # Compute vol width in basis points
                    p95 = p.get("0.95", current)
                    p05 = p.get("0.05", current)
                    row[f"range_bps_{horizon}"] = round((p95 - p05) / current * 10000, 1)
                else:
                    row[f"vol_{horizon}"] = None
                    row[f"range_bps_{horizon}"] = None
            else:
                row[f"vol_{horizon}"] = None
                row[f"range_bps_{horizon}"] = None

        # Vol term structure: ratio of 24h vol to 1h vol
        if row.get("vol_1h") and row.get("vol_24h"):
            row["vol_term_ratio"] = round(row["vol_24h"] / row["vol_1h"], 3)
        else:
            row["vol_term_ratio"] = None

        # Asset class
        if asset in ("BTC", "ETH", "SOL"):
            row["class"] = "crypto"
        elif asset == "XAU":
            row["class"] = "commodity"
        else:
            row["class"] = "equity"

        results.append(row)

    # Compute class averages
    class_vols = {}
    for r in results:
        cls = r["class"]
        if cls not in class_vols:
            class_vols[cls] = []
        if r.get("vol_24h"):
            class_vols[cls].append(r["vol_24h"])

    class_avg = {c: round(sum(v) / len(v), 4) if v else None for c, v in class_vols.items()}

    # Rank by 24h vol descending
    results.sort(key=lambda x: x.get("vol_24h") or 0, reverse=True)

    return {
        "data": {
            "assets": results,
            "class_averages": class_avg,
            "crypto_equity_vol_ratio": (
                round(class_avg.get("crypto", 0) / class_avg.get("equity", 0.001), 2)
                if class_avg.get("crypto") and class_avg.get("equity")
                else None
            ),
        }
    }


# ─── DISTRIBUTION SHAPE ANALYSIS (derived) ──────────────────────────────
@router.get("/distribution")
async def get_distribution_analysis(
    asset: str = Query(...),
    horizon: str = Query("24h"),
):
    """
    Full distribution shape analysis for a single asset.
    Returns: percentile levels, return ranges, probability mass in each band,
    skew analysis, tail metrics, and confidence intervals.
    """
    raw = await get_cached_synth(asset, horizon)
    if not raw:
        raise HTTPException(status_code=404, detail=f"No data for {asset}/{horizon}")

    current = raw.get("current_price", 0)
    p = get_last_percentiles(raw)
    if not p or not current:
        raise HTTPException(status_code=404, detail="No percentile data")

    # Return at each percentile level
    returns = {}
    for k, v in p.items():
        ret = (v - current) / current
        returns[k] = round(ret * 100, 4)  # as percentage

    # Probability mass in each band
    bands = {
        "extreme_downside_0_5pct": {"range": f"< {returns.get('0.005', 0):.2f}%", "prob": 0.5},
        "strong_downside_5pct": {"range": f"{returns.get('0.005', 0):.2f}% to {returns.get('0.05', 0):.2f}%", "prob": 4.5},
        "moderate_downside_20pct": {"range": f"{returns.get('0.05', 0):.2f}% to {returns.get('0.2', 0):.2f}%", "prob": 15.0},
        "mild_downside_35pct": {"range": f"{returns.get('0.2', 0):.2f}% to {returns.get('0.35', 0):.2f}%", "prob": 15.0},
        "core_range_50pct": {"range": f"{returns.get('0.35', 0):.2f}% to {returns.get('0.65', 0):.2f}%", "prob": 30.0},
        "mild_upside_65pct": {"range": f"{returns.get('0.65', 0):.2f}% to {returns.get('0.8', 0):.2f}%", "prob": 15.0},
        "moderate_upside_80pct": {"range": f"{returns.get('0.8', 0):.2f}% to {returns.get('0.95', 0):.2f}%", "prob": 15.0},
        "strong_upside_95pct": {"range": f"{returns.get('0.95', 0):.2f}% to {returns.get('0.995', 0):.2f}%", "prob": 4.5},
        "extreme_upside_99_5pct": {"range": f"> {returns.get('0.995', 0):.2f}%", "prob": 0.5},
    }

    # Confidence intervals
    p90_low = p.get("0.05", current)
    p90_high = p.get("0.95", current)
    p60_low = p.get("0.2", current)
    p60_high = p.get("0.8", current)

    # Skew analysis
    upside_tail = p.get("0.95", current) - p.get("0.5", current)
    downside_tail = p.get("0.5", current) - p.get("0.05", current)
    skew_ratio = upside_tail / max(downside_tail, 0.001)

    return {
        "data": {
            "asset": asset,
            "horizon": horizon,
            "current_price": current,
            "percentile_prices": {k: round(v, 2) for k, v in p.items()},
            "percentile_returns_pct": returns,
            "probability_bands": bands,
            "confidence_intervals": {
                "ci_90": {
                    "low": round(p90_low, 2),
                    "high": round(p90_high, 2),
                    "width_pct": round((p90_high - p90_low) / current * 100, 4),
                },
                "ci_60": {
                    "low": round(p60_low, 2),
                    "high": round(p60_high, 2),
                    "width_pct": round((p60_high - p60_low) / current * 100, 4),
                },
            },
            "skew_analysis": {
                "upside_range": round(upside_tail, 2),
                "downside_range": round(downside_tail, 2),
                "skew_ratio": round(skew_ratio, 4),
                "interpretation": (
                    "upside_skewed" if skew_ratio > 1.1
                    else "downside_skewed" if skew_ratio < 0.9
                    else "symmetric"
                ),
            },
        }
    }


# ─── VOL TERM STRUCTURE (derived) ───────────────────────────────────────
@router.get("/vol-term-structure")
async def get_vol_term_structure(asset: str = Query(...)):
    """
    Volatility term structure for a single asset — compares 1h vs 24h vol.
    Backwardation = short-term vol > long-term vol (unusual, signals stress).
    Contango = long-term vol > short-term vol (normal).
    """
    vols = {}
    for horizon in ["1h", "24h"]:
        raw = await get_cached_synth(asset, horizon)
        if raw:
            p = get_last_percentiles(raw)
            current = raw.get("current_price", 0)
            if p and current:
                vols[horizon] = round(implied_vol(p, current, horizon), 4)

    if not vols:
        raise HTTPException(status_code=404, detail=f"No vol data for {asset}")

    vol_1h = vols.get("1h")
    vol_24h = vols.get("24h")

    structure = "unknown"
    if vol_1h and vol_24h:
        if vol_1h > vol_24h * 1.1:
            structure = "backwardation"
        elif vol_24h > vol_1h * 1.1:
            structure = "contango"
        else:
            structure = "flat"

    return {
        "data": {
            "asset": asset,
            "vol_1h_annualized": vol_1h,
            "vol_24h_annualized": vol_24h,
            "term_structure": structure,
            "ratio": round(vol_24h / vol_1h, 3) if vol_1h and vol_24h else None,
            "signal": (
                "STRESS — short-term vol elevated" if structure == "backwardation"
                else "NORMAL — vol increases with horizon" if structure == "contango"
                else "FLAT — no term premium"
            ),
        }
    }
