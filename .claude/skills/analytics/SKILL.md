# SKILL: Analytics Engine

## Overview
Mathematical models and algorithms used in SynthEdge analytics layer.

## Value at Risk (VaR) from Synth Distributions

Instead of historical VaR, we use Synth's forward-looking distributions.

### Parametric VaR from Percentiles
```python
import numpy as np

def parametric_var(
    positions: list[dict],  # [{"asset": "BTC", "notional": 10000, "direction": "long"}]
    percentiles: dict[str, dict],  # {"BTC": {percentile_data}, ...}
    confidence: float = 0.95,
    horizon: str = "24h"
) -> dict:
    """
    Compute portfolio VaR from Synth's percentile distributions.
    
    For each position:
    1. Get the return at the confidence percentile from Synth
    2. Scale by position notional
    3. Aggregate (simple sum for uncorrelated, or use correlation from cross-asset data)
    """
    position_vars = []
    
    for pos in positions:
        asset_p = percentiles[pos["asset"]]
        current = asset_p["current_price"]
        
        # Get last timestep percentiles (end of horizon)
        final_percentiles = asset_p["forecast_future"]["percentiles"][-1]
        
        if pos["direction"] == "long":
            # Loss = current - low_percentile
            loss_price = final_percentiles[str(1 - confidence)]  # e.g., 0.05 for 95% VaR
            loss_pct = (current - loss_price) / current
        else:
            # Short: loss = high_percentile - current
            loss_price = final_percentiles[str(confidence)]  # e.g., 0.95 for 95% VaR
            loss_pct = (loss_price - current) / current
        
        position_var = pos["notional"] * loss_pct
        position_vars.append(position_var)
    
    # Simple sum (conservative, ignores diversification)
    portfolio_var = sum(position_vars)
    
    return {
        "portfolio_var": portfolio_var,
        "position_vars": position_vars,
        "confidence": confidence,
        "horizon": horizon
    }
```

### CVaR (Expected Shortfall)
```python
def cvar_from_percentiles(percentiles_at_horizon: dict, current_price: float, 
                          confidence: float = 0.95) -> float:
    """
    CVaR = average loss beyond VaR threshold.
    Approximate by averaging all percentile prices below the VaR level.
    """
    var_level = 1 - confidence  # e.g., 0.05
    
    below_var = [
        (float(k), v) for k, v in percentiles_at_horizon.items()
        if float(k) <= var_level
    ]
    
    if not below_var:
        return 0.0
    
    avg_loss_price = np.mean([p for _, p in below_var])
    cvar_pct = (current_price - avg_loss_price) / current_price
    return cvar_pct
```

## Kelly Criterion

```python
def kelly_fraction(
    win_probability: float,
    avg_win_pct: float,
    avg_loss_pct: float,
    fraction: float = 0.5  # Half-Kelly default (safer)
) -> float:
    """
    Kelly fraction for position sizing.
    
    f* = (p * b - q) / b
    where:
      p = win probability
      q = 1 - p (loss probability)
      b = win/loss ratio
    
    Then multiply by `fraction` for fractional Kelly.
    """
    q = 1 - win_probability
    b = avg_win_pct / max(avg_loss_pct, 0.001)
    
    kelly = (win_probability * b - q) / b
    kelly = max(kelly, 0)  # Never negative (don't bet if no edge)
    
    return kelly * fraction


def kelly_from_synth(
    percentiles_at_horizon: dict,
    current_price: float,
    entry_price: float,
    take_profit: float,
    stop_loss: float,
    fraction: float = 0.5
) -> dict:
    """
    Compute Kelly using Synth's distribution to estimate win/loss probabilities.
    """
    # Estimate probability of hitting TP vs SL from percentile bands
    # Interpolate where TP and SL fall in the distribution
    
    sorted_levels = sorted(
        [(float(k), v) for k, v in percentiles_at_horizon.items()],
        key=lambda x: x[1]
    )
    
    def price_to_percentile(price):
        for i, (pct, p) in enumerate(sorted_levels):
            if price <= p:
                if i == 0:
                    return pct
                prev_pct, prev_p = sorted_levels[i-1]
                frac = (price - prev_p) / (p - prev_p)
                return prev_pct + frac * (pct - prev_pct)
        return 1.0
    
    tp_percentile = price_to_percentile(take_profit)
    sl_percentile = price_to_percentile(stop_loss)
    
    # For a long trade:
    # P(win) ≈ 1 - tp_percentile (probability of being above TP)
    # P(loss) ≈ sl_percentile (probability of being below SL)
    # Normalize since they don't sum to 1 (price could end between SL and TP)
    
    win_pct = abs(take_profit - entry_price) / entry_price
    loss_pct = abs(entry_price - stop_loss) / entry_price
    
    win_prob = 1 - tp_percentile
    loss_prob = sl_percentile
    total = win_prob + loss_prob
    
    if total > 0:
        win_prob /= total
        loss_prob /= total
    
    k = kelly_fraction(win_prob, win_pct, loss_pct, fraction)
    
    return {
        "kelly_fraction": k,
        "win_probability": win_prob,
        "loss_probability": loss_prob,
        "avg_win_pct": win_pct,
        "avg_loss_pct": loss_pct,
        "recommended_position_pct": k * 100
    }
```

## Regime Detection

```python
from enum import Enum

class MarketRegime(str, Enum):
    LOW_VOL_GRIND = "low_vol_grind"
    HIGH_VOL_TREND = "high_vol_trend"
    MEAN_REVERSION = "mean_reversion"
    TAIL_RISK = "tail_risk"

def detect_regime(percentiles: dict, current_price: float) -> dict:
    """
    Classify market regime from distribution shape.
    Uses last-timestep percentiles.
    """
    p = percentiles
    
    # Width metrics
    wide_range = (p["0.95"] - p["0.05"]) / current_price
    narrow_range = (p["0.65"] - p["0.35"]) / current_price
    
    # Skew
    upside = p["0.95"] - p["0.5"]
    downside = p["0.5"] - p["0.05"]
    skew = (upside - downside) / max(upside + downside, 0.001)
    
    # Kurtosis proxy
    tail_range = p["0.995"] - p["0.005"]
    body_range = p["0.8"] - p["0.2"]
    kurtosis = tail_range / max(body_range, 0.001) if body_range > 0 else 3.0
    
    # Direction strength
    median_move = (p["0.5"] - current_price) / current_price
    
    # Classification logic
    if kurtosis > 4.0 and wide_range > 0.05:
        regime = MarketRegime.TAIL_RISK
    elif wide_range > 0.03 and abs(median_move) > 0.005:
        regime = MarketRegime.HIGH_VOL_TREND
    elif wide_range < 0.015:
        regime = MarketRegime.LOW_VOL_GRIND
    else:
        regime = MarketRegime.MEAN_REVERSION
    
    return {
        "regime": regime,
        "vol_range": wide_range,
        "skew": skew,
        "kurtosis_proxy": kurtosis,
        "median_move_pct": median_move * 100,
        "description": REGIME_DESCRIPTIONS[regime]
    }

REGIME_DESCRIPTIONS = {
    MarketRegime.LOW_VOL_GRIND: "Low volatility, tight ranges. Favor mean-reversion, sell vol.",
    MarketRegime.HIGH_VOL_TREND: "High volatility with directional bias. Favor trend-following.",
    MarketRegime.MEAN_REVERSION: "Moderate volatility, balanced distribution. Fade extremes.",
    MarketRegime.TAIL_RISK: "Fat tails detected. Reduce leverage, hedge downside.",
}
```

## Funding Rate Arbitrage Signal

```python
def funding_arbitrage_signal(
    synth_up_probability: float,
    funding_rate_8h: float,  # Hyperliquid 8h funding rate
    threshold: float = 0.15  # Minimum divergence
) -> dict:
    """
    When funding rate and Synth's directional forecast disagree → signal.
    
    Negative funding = market paying shorts (bearish sentiment)
    + Synth says >60% up = contrarian long signal (collect funding + edge)
    
    Positive funding = market paying longs (bullish sentiment)  
    + Synth says <40% up = contrarian short signal
    """
    annualized_funding = funding_rate_8h * 3 * 365  # 3 periods/day * 365 days
    
    # Normalize: positive = bullish sentiment, negative = bearish
    funding_signal = -1 if funding_rate_8h < 0 else 1  # Negative funding → bearish
    synth_signal = 1 if synth_up_probability > 0.5 else -1
    
    divergence = abs(synth_up_probability - 0.5) + abs(annualized_funding)
    
    if funding_signal != synth_signal and divergence > threshold:
        direction = "long" if synth_signal > 0 else "short"
        return {
            "signal": True,
            "direction": direction,
            "synth_up_prob": synth_up_probability,
            "funding_rate_8h": funding_rate_8h,
            "annualized_funding": annualized_funding,
            "edge_score": divergence,
            "rationale": f"Funding is {'negative' if funding_rate_8h < 0 else 'positive'} "
                        f"({annualized_funding:.1%} ann.) but Synth sees "
                        f"{synth_up_probability:.0%} up probability."
        }
    
    return {"signal": False, "edge_score": divergence}
```

## Rust Performance Modules (PyO3)

Use Rust for these hot paths:

### Monte Carlo VaR (10K+ simulations)
When we have full price paths (from /v2/prediction/best), simulate portfolio outcomes.

### Percentile Interpolation at Scale
When processing all 9 assets × 2 horizons × 289 timesteps simultaneously.

### Distribution Statistics Batch
Computing skew, kurtosis, vol for all assets in one pass.

```rust
// Example: batch_distribution_stats in Rust
use numpy::PyArray1;
use pyo3::prelude::*;

#[pyfunction]
fn batch_implied_vol(
    percentiles_5: Vec<f64>,
    percentiles_95: Vec<f64>, 
    current_prices: Vec<f64>,
    horizon_hours: f64
) -> Vec<f64> {
    let annual_factor = (8760.0 / horizon_hours).sqrt();
    percentiles_5.iter()
        .zip(percentiles_95.iter())
        .zip(current_prices.iter())
        .map(|((p5, p95), cp)| {
            let range_pct = (p95 - p5) / cp;
            let sigma = range_pct / (2.0 * 1.645);
            sigma * annual_factor
        })
        .collect()
}
```
