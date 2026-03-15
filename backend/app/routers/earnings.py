"""Earnings Volatility Dashboard.

Compares Synth's current forecast volatility against historical earnings-day
moves for equity assets. Flags when current implied vol deviates significantly
from typical earnings vol — useful for pre-earnings positioning.

Historical data sourced from public earnings reports (2024-2025).
"""

import math
from datetime import datetime, timezone
from fastapi import APIRouter, Query

from app.services.synth_service import get_cached_synth, get_cached_derived
from app.core.derivations import get_last_percentiles, implied_vol

router = APIRouter(prefix="/api/earnings", tags=["earnings"])

# Historical earnings moves (absolute 1-day % change after earnings)
# Source: Public market data, Yahoo Finance
HISTORICAL_EARNINGS = {
    "NVDA": {
        "name": "NVIDIA",
        "next_earnings": "2026-05-28",  # Estimated
        "history": [
            {"date": "2025-02-26", "move_pct": 8.5, "direction": "up", "quarter": "Q4 FY25"},
            {"date": "2024-11-20", "move_pct": 3.2, "direction": "down", "quarter": "Q3 FY25"},
            {"date": "2024-08-28", "move_pct": 6.4, "direction": "up", "quarter": "Q2 FY25"},
            {"date": "2024-05-22", "move_pct": 9.3, "direction": "up", "quarter": "Q1 FY25"},
            {"date": "2024-02-21", "move_pct": 16.4, "direction": "up", "quarter": "Q4 FY24"},
            {"date": "2023-11-21", "move_pct": 0.1, "direction": "down", "quarter": "Q3 FY24"},
        ],
    },
    "TSLA": {
        "name": "Tesla",
        "next_earnings": "2026-04-22",
        "history": [
            {"date": "2025-01-29", "move_pct": 2.2, "direction": "down", "quarter": "Q4 FY24"},
            {"date": "2024-10-23", "move_pct": 22.0, "direction": "up", "quarter": "Q3 FY24"},
            {"date": "2024-07-23", "move_pct": 12.3, "direction": "down", "quarter": "Q2 FY24"},
            {"date": "2024-04-23", "move_pct": 12.1, "direction": "up", "quarter": "Q1 FY24"},
            {"date": "2024-01-24", "move_pct": 12.1, "direction": "down", "quarter": "Q4 FY23"},
            {"date": "2023-10-18", "move_pct": 9.3, "direction": "down", "quarter": "Q3 FY23"},
        ],
    },
    "AAPL": {
        "name": "Apple",
        "next_earnings": "2026-05-01",
        "history": [
            {"date": "2025-01-30", "move_pct": 3.7, "direction": "up", "quarter": "Q1 FY25"},
            {"date": "2024-10-31", "move_pct": 1.3, "direction": "down", "quarter": "Q4 FY24"},
            {"date": "2024-08-01", "move_pct": 0.4, "direction": "down", "quarter": "Q3 FY24"},
            {"date": "2024-05-02", "move_pct": 6.0, "direction": "up", "quarter": "Q2 FY24"},
            {"date": "2024-02-01", "move_pct": 0.5, "direction": "down", "quarter": "Q1 FY24"},
            {"date": "2023-11-02", "move_pct": 0.5, "direction": "down", "quarter": "Q4 FY23"},
        ],
    },
    "GOOGL": {
        "name": "Google",
        "next_earnings": "2026-04-29",
        "history": [
            {"date": "2025-02-04", "move_pct": 7.6, "direction": "down", "quarter": "Q4 FY24"},
            {"date": "2024-10-29", "move_pct": 1.7, "direction": "down", "quarter": "Q3 FY24"},
            {"date": "2024-07-23", "move_pct": 5.0, "direction": "down", "quarter": "Q2 FY24"},
            {"date": "2024-04-25", "move_pct": 10.2, "direction": "up", "quarter": "Q1 FY24"},
            {"date": "2024-01-30", "move_pct": 7.5, "direction": "down", "quarter": "Q4 FY23"},
            {"date": "2023-10-24", "move_pct": 9.7, "direction": "down", "quarter": "Q3 FY23"},
        ],
    },
    "SPY": {
        "name": "S&P 500",
        "next_earnings": None,  # Index, no earnings
        "history": [],  # No earnings data - used as vol benchmark
    },
}

EQUITY_ASSETS = ["NVDA", "TSLA", "AAPL", "GOOGL", "SPY"]


@router.get("/dashboard")
async def earnings_dashboard(horizon: str = Query("24h")):
    """
    Earnings volatility dashboard comparing:
    1. Synth's current forecast implied vol (annualized)
    2. Synth's expected 24h move (from distribution width)
    3. Historical average earnings-day moves
    4. Whether current vol is elevated vs historical earnings vol
    """
    results = []

    for asset in EQUITY_ASSETS:
        earnings_info = HISTORICAL_EARNINGS.get(asset, {})
        history = earnings_info.get("history", [])

        # Get Synth data
        derived = await get_cached_derived(asset, horizon)
        raw = await get_cached_synth(asset, horizon)

        if not derived or "error" in derived:
            continue

        current_price = derived["current_price"]
        synth_vol = derived["implied_vol_annualized"]

        # Compute expected move from percentiles (actual distribution width)
        expected_move_pct = 0.0
        p05_price = current_price
        p95_price = current_price
        if raw:
            p = get_last_percentiles(raw)
            if p:
                p95_price = p.get("0.95", current_price)
                p05_price = p.get("0.05", current_price)
                expected_move_pct = (p95_price - p05_price) / current_price * 100

        # Historical earnings stats
        avg_earnings_move = 0.0
        max_earnings_move = 0.0
        earnings_up_pct = 0.0
        if history:
            moves = [h["move_pct"] for h in history]
            avg_earnings_move = sum(moves) / len(moves)
            max_earnings_move = max(moves)
            up_count = sum(1 for h in history if h["direction"] == "up")
            earnings_up_pct = up_count / len(history)

        # Compare: is current vol high or low vs earnings vol?
        # Convert avg earnings move to annualized vol for comparison
        # 1-day move ≈ daily vol, annualized = daily * sqrt(252)
        if avg_earnings_move > 0:
            historical_daily_vol = avg_earnings_move / 100
            historical_ann_vol = historical_daily_vol * math.sqrt(252)
            vol_ratio = synth_vol / historical_ann_vol if historical_ann_vol > 0 else 1.0
        else:
            historical_ann_vol = 0
            vol_ratio = 1.0

        # Signal interpretation
        if vol_ratio > 1.5:
            vol_signal = "ELEVATED"
            vol_interpretation = "Current vol ABOVE historical earnings vol. Market pricing in unusual uncertainty."
        elif vol_ratio < 0.5:
            vol_signal = "COMPRESSED"
            vol_interpretation = "Current vol BELOW historical earnings vol. Potential vol expansion ahead."
        else:
            vol_signal = "NORMAL"
            vol_interpretation = "Current vol in line with historical earnings patterns."

        results.append({
            "asset": asset,
            "name": earnings_info.get("name", asset),
            "current_price": current_price,
            "next_earnings": earnings_info.get("next_earnings"),
            # Synth forecast data
            "synth": {
                "implied_vol_annualized": round(synth_vol, 4),
                "expected_move_24h_pct": round(expected_move_pct, 4),
                "expected_move_24h_range": {
                    "low": round(p05_price, 2),
                    "high": round(p95_price, 2),
                },
                "direction": derived["direction"],
                "up_probability": derived["up_probability"],
                "regime": derived["regime"],
            },
            # Historical earnings data
            "historical": {
                "avg_earnings_move_pct": round(avg_earnings_move, 2),
                "max_earnings_move_pct": round(max_earnings_move, 2),
                "earnings_up_pct": round(earnings_up_pct, 2),
                "num_quarters": len(history),
                "recent_moves": history[:4],  # Last 4 quarters
            },
            # Comparison
            "comparison": {
                "vol_ratio": round(vol_ratio, 3),
                "signal": vol_signal,
                "interpretation": vol_interpretation,
                "synth_vs_avg": round(expected_move_pct - avg_earnings_move, 2) if avg_earnings_move > 0 else None,
            },
        })

    return {
        "data": {
            "assets": results,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "horizon": horizon,
        }
    }
