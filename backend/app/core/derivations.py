"""Derive all analytics locally from Synth percentile data."""

from enum import Enum
from datetime import datetime, timezone
import math


ASSETS = ["BTC", "ETH", "SOL", "XAU", "SPY", "NVDA", "TSLA", "AAPL", "GOOGL"]
HORIZONS = ["1h", "24h"]

HORIZON_HOURS = {"1h": 1.0, "24h": 24.0}


class MarketRegime(str, Enum):
    LOW_VOL_GRIND = "low_vol_grind"
    HIGH_VOL_TREND = "high_vol_trend"
    MEAN_REVERSION = "mean_reversion"
    TAIL_RISK = "tail_risk"


REGIME_DESCRIPTIONS = {
    MarketRegime.LOW_VOL_GRIND: "Low volatility, tight ranges. Favor mean-reversion, sell vol.",
    MarketRegime.HIGH_VOL_TREND: "High volatility with directional bias. Favor trend-following.",
    MarketRegime.MEAN_REVERSION: "Moderate volatility, balanced distribution. Fade extremes.",
    MarketRegime.TAIL_RISK: "Fat tails detected. Reduce leverage, hedge downside.",
}


def get_last_percentiles(data: dict) -> dict[str, float]:
    """Extract the last timestep percentiles from Synth response."""
    percentiles = data.get("forecast_future", {}).get("percentiles", [])
    if not percentiles:
        return {}
    return percentiles[-1]


def implied_vol(p: dict[str, float], current_price: float, horizon: str) -> float:
    hours = HORIZON_HOURS.get(horizon, 24.0)
    p95 = p.get("0.95", current_price)
    p05 = p.get("0.05", current_price)
    range_pct = (p95 - p05) / max(current_price, 0.01)
    annual_factor = math.sqrt(8760 / hours)
    sigma = range_pct / (2 * 1.645)
    return sigma * annual_factor


def directional_probability(p: dict[str, float], current_price: float) -> dict:
    median = p.get("0.5", current_price)
    p35 = p.get("0.35", current_price)
    p65 = p.get("0.65", current_price)

    lean = "bullish" if median > current_price else "bearish"
    width = p65 - p35
    deviation = abs(median - current_price)
    conviction = min(deviation / max(width, 0.001), 1.0)

    # Approximate up probability
    if current_price <= p.get("0.05", current_price):
        up_prob = 0.95
    elif current_price >= p.get("0.95", current_price):
        up_prob = 0.05
    elif current_price <= p.get("0.35", current_price):
        up_prob = 0.65 + 0.30 * (p.get("0.35", current_price) - current_price) / max(p.get("0.35", current_price) - p.get("0.05", current_price), 0.001)
    elif current_price <= median:
        up_prob = 0.50 + 0.15 * (median - current_price) / max(median - p35, 0.001)
    elif current_price <= p65:
        up_prob = 0.35 + 0.15 * (p65 - current_price) / max(p65 - median, 0.001)
    else:
        up_prob = 0.05 + 0.30 * (p.get("0.95", current_price) - current_price) / max(p.get("0.95", current_price) - p65, 0.001)

    up_prob = max(0.01, min(0.99, up_prob))

    return {"lean": lean, "conviction": conviction, "up_probability": up_prob, "median": median}


def distribution_skew(p: dict[str, float]) -> float:
    p95 = p.get("0.95", 0)
    p50 = p.get("0.5", 0)
    p05 = p.get("0.05", 0)
    upside = p95 - p50
    downside = p50 - p05
    return (upside - downside) / max(upside + downside, 0.001)


def distribution_kurtosis(p: dict[str, float]) -> float:
    tail = p.get("0.995", 0) - p.get("0.005", 0)
    body = p.get("0.8", 0) - p.get("0.2", 0)
    return tail / max(body, 0.001)


def detect_regime(p: dict[str, float], current_price: float) -> dict:
    wide_range = (p.get("0.95", current_price) - p.get("0.05", current_price)) / max(current_price, 0.01)
    skew = distribution_skew(p)
    kurtosis = distribution_kurtosis(p)
    median_move = (p.get("0.5", current_price) - current_price) / max(current_price, 0.01)

    if kurtosis > 4.0 and wide_range > 0.05:
        regime = MarketRegime.TAIL_RISK
    elif wide_range > 0.03 and abs(median_move) > 0.005:
        regime = MarketRegime.HIGH_VOL_TREND
    elif wide_range < 0.015:
        regime = MarketRegime.LOW_VOL_GRIND
    else:
        regime = MarketRegime.MEAN_REVERSION

    return {
        "regime": regime.value,
        "description": REGIME_DESCRIPTIONS[regime],
        "vol_range": round(wide_range, 6),
        "skew": round(skew, 4),
        "kurtosis_proxy": round(kurtosis, 4),
        "median_move_pct": round(median_move * 100, 4),
    }


def tail_risk_metrics(p: dict[str, float], current_price: float) -> dict:
    def drop_prob(drop_pct: float) -> float:
        target = current_price * (1 - drop_pct)
        levels = sorted([(float(k), v) for k, v in p.items()], key=lambda x: x[1])
        for i, (pct, price) in enumerate(levels):
            if target <= price:
                if i == 0:
                    return pct
                prev_pct, prev_price = levels[i - 1]
                frac = (target - prev_price) / max(price - prev_price, 0.001)
                return prev_pct + frac * (pct - prev_pct)
        return 1.0

    return {
        "prob_2pct_drop": round(drop_prob(0.02), 4),
        "prob_5pct_drop": round(drop_prob(0.05), 4),
        "prob_10pct_drop": round(drop_prob(0.10), 4),
    }


def compute_derived_metrics(data: dict, asset: str, horizon: str) -> dict:
    current_price = data.get("current_price", 0)
    p = get_last_percentiles(data)
    if not p or not current_price:
        return {"asset": asset, "horizon": horizon, "error": "no_data"}

    dp = directional_probability(p, current_price)
    regime = detect_regime(p, current_price)
    tail = tail_risk_metrics(p, current_price)

    return {
        "asset": asset,
        "horizon": horizon,
        "current_price": current_price,
        "implied_vol_annualized": round(implied_vol(p, current_price, horizon), 4),
        "up_probability": round(dp["up_probability"], 4),
        "direction": dp["lean"],
        "conviction": round(dp["conviction"], 4),
        "median_forecast": dp["median"],
        "skew": round(distribution_skew(p), 4),
        "kurtosis_proxy": round(distribution_kurtosis(p), 4),
        "regime": regime["regime"],
        "regime_description": regime["description"],
        "tail_risk": tail,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def kelly_from_synth(
    percentiles: dict[str, float],
    current_price: float,
    entry_price: float,
    take_profit: float,
    stop_loss: float,
    direction: str = "long",
    fraction: float = 0.5,
) -> dict:
    sorted_levels = sorted(
        [(float(k), v) for k, v in percentiles.items()],
        key=lambda x: x[1],
    )

    def price_to_percentile(price: float) -> float:
        for i, (pct, p) in enumerate(sorted_levels):
            if price <= p:
                if i == 0:
                    return pct
                prev_pct, prev_p = sorted_levels[i - 1]
                frac = (price - prev_p) / max(p - prev_p, 0.001)
                return prev_pct + frac * (pct - prev_pct)
        return 1.0

    if direction == "long":
        win_pct = abs(take_profit - entry_price) / max(entry_price, 0.01)
        loss_pct = abs(entry_price - stop_loss) / max(entry_price, 0.01)
        tp_percentile = price_to_percentile(take_profit)
        sl_percentile = price_to_percentile(stop_loss)
        win_prob = 1 - tp_percentile
        loss_prob = sl_percentile
    else:
        win_pct = abs(entry_price - take_profit) / max(entry_price, 0.01)
        loss_pct = abs(stop_loss - entry_price) / max(entry_price, 0.01)
        tp_percentile = price_to_percentile(take_profit)
        sl_percentile = price_to_percentile(stop_loss)
        win_prob = tp_percentile
        loss_prob = 1 - sl_percentile

    total = win_prob + loss_prob
    if total > 0:
        win_prob /= total
        loss_prob /= total

    # Kelly fraction: f* = (p*b - q) / b
    b = win_pct / max(loss_pct, 0.001)
    q = 1 - win_prob
    kelly = max((win_prob * b - q) / b, 0) * fraction

    # Suggest realistic TP/SL from percentiles
    suggested_tp_long = percentiles.get("0.8", current_price * 1.01)  # 80th percentile
    suggested_sl_long = percentiles.get("0.2", current_price * 0.99)  # 20th percentile
    suggested_tp_short = percentiles.get("0.2", current_price * 0.99)
    suggested_sl_short = percentiles.get("0.8", current_price * 1.01)

    # Warning if TP/SL are outside the distribution
    max_price = max(v for v in percentiles.values())
    min_price = min(v for v in percentiles.values())
    warning = None
    if direction == "long" and take_profit > max_price:
        warning = f"TP ${take_profit:.2f} is above 99.5th percentile ${max_price:.2f}. Consider a lower target."
    elif direction == "short" and take_profit < min_price:
        warning = f"TP ${take_profit:.2f} is below 0.5th percentile ${min_price:.2f}. Consider a higher target."

    return {
        "kelly_fraction": round(kelly, 4),
        "win_probability": round(win_prob, 4),
        "loss_probability": round(loss_prob, 4),
        "avg_win_pct": round(win_pct, 4),
        "avg_loss_pct": round(loss_pct, 4),
        "recommended_position_pct": round(kelly * 100, 2),
        "suggested_levels": {
            "long": {"tp": round(suggested_tp_long, 2), "sl": round(suggested_sl_long, 2)},
            "short": {"tp": round(suggested_tp_short, 2), "sl": round(suggested_sl_short, 2)},
        },
        "distribution_range": {"min": round(min_price, 2), "max": round(max_price, 2)},
        "warning": warning,
    }


def liquidation_probability(p: dict[str, float], liq_price: float) -> float:
    levels = sorted([(float(k), v) for k, v in p.items()], key=lambda x: x[1])
    for i, (pct, price) in enumerate(levels):
        if liq_price <= price:
            if i == 0:
                return pct
            prev_pct, prev_price = levels[i - 1]
            frac = (liq_price - prev_price) / max(price - prev_price, 0.001)
            return prev_pct + frac * (pct - prev_pct)
    return 1.0
