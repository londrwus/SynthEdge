"""Tests for app.core.derivations — quant math correctness.

Covers: implied_vol, directional_probability, distribution_skew,
        distribution_kurtosis, detect_regime, kelly_from_synth,
        liquidation_probability, compute_derived_metrics, tail_risk_metrics.
"""

import math
import pytest

from app.core.derivations import (
    implied_vol,
    directional_probability,
    distribution_skew,
    distribution_kurtosis,
    detect_regime,
    kelly_from_synth,
    liquidation_probability,
    compute_derived_metrics,
    get_last_percentiles,
    tail_risk_metrics,
    MarketRegime,
)


# ──────────────────────────────────────────────────────────────────
# implied_vol
# ──────────────────────────────────────────────────────────────────

class TestImpliedVol:
    def test_reasonable_range_24h(self, last_percentiles):
        """Annualized vol should be between 1% and 500%."""
        vol = implied_vol(last_percentiles, 71007.68, "24h")
        assert 0.01 <= vol <= 5.0, f"Vol {vol} outside reasonable range"

    def test_reasonable_range_1h(self, last_percentiles):
        """1h vol annualized should be higher than 24h for same percentiles
        because sqrt(8760/1) > sqrt(8760/24)."""
        vol = implied_vol(last_percentiles, 71007.68, "1h")
        assert 0.01 <= vol <= 5.0, f"Vol {vol} outside reasonable range"

    def test_1h_vol_higher_than_24h_same_spread(self, last_percentiles):
        """Annualising a 1h spread produces higher vol than 24h spread
        (because the annualization factor is larger)."""
        vol_1h = implied_vol(last_percentiles, 71007.68, "1h")
        vol_24h = implied_vol(last_percentiles, 71007.68, "24h")
        assert vol_1h > vol_24h

    def test_wider_spread_gives_higher_vol(self):
        """Doubling the 5-95 range should roughly double vol."""
        narrow = {"0.05": 99.0, "0.95": 101.0, "0.5": 100.0,
                  "0.005": 98.0, "0.2": 99.5, "0.35": 99.7,
                  "0.65": 100.3, "0.8": 100.5, "0.995": 102.0}
        wide = {k: v * 2 - 100 for k, v in narrow.items()}  # widen around 100
        # Actually just double the spread manually
        wide = {"0.05": 98.0, "0.95": 102.0, "0.5": 100.0,
                "0.005": 96.0, "0.2": 99.0, "0.35": 99.5,
                "0.65": 100.5, "0.8": 101.0, "0.995": 104.0}

        vol_narrow = implied_vol(narrow, 100.0, "24h")
        vol_wide = implied_vol(wide, 100.0, "24h")
        assert vol_wide > vol_narrow

    def test_zero_price_no_crash(self):
        """Should not crash with zero current price (uses max(price,0.01))."""
        p = {"0.05": 1.0, "0.95": 2.0}
        vol = implied_vol(p, 0.0, "24h")
        assert vol > 0


# ──────────────────────────────────────────────────────────────────
# directional_probability
# ──────────────────────────────────────────────────────────────────

class TestDirectionalProbability:
    def test_bullish_when_median_above(self, btc_bullish_response):
        p = get_last_percentiles(btc_bullish_response)
        current = btc_bullish_response["current_price"]
        result = directional_probability(p, current)
        assert result["lean"] == "bullish"
        assert result["up_probability"] > 0.5

    def test_bearish_when_median_below(self, btc_bearish_response):
        p = get_last_percentiles(btc_bearish_response)
        current = btc_bearish_response["current_price"]
        result = directional_probability(p, current)
        assert result["lean"] == "bearish"
        assert result["up_probability"] < 0.5

    def test_up_probability_bounded(self, last_percentiles):
        """Up probability must always be between 0.01 and 0.99."""
        result = directional_probability(last_percentiles, 71007.68)
        assert 0.01 <= result["up_probability"] <= 0.99

    def test_conviction_bounded(self, last_percentiles):
        """Conviction is clamped to [0, 1]."""
        result = directional_probability(last_percentiles, 71007.68)
        assert 0.0 <= result["conviction"] <= 1.0

    def test_extreme_price_below_p05(self):
        """When current price is below p05, up_probability should be high."""
        p = {"0.005": 90.0, "0.05": 95.0, "0.2": 98.0, "0.35": 99.0,
             "0.5": 100.0, "0.65": 101.0, "0.8": 102.0, "0.95": 105.0, "0.995": 110.0}
        result = directional_probability(p, 93.0)  # below p05
        assert result["up_probability"] > 0.9


# ──────────────────────────────────────────────────────────────────
# distribution_skew
# ──────────────────────────────────────────────────────────────────

class TestDistributionSkew:
    def test_positive_skew_when_upside_larger(self):
        """Skew > 0 when upside tail is larger than downside."""
        p = {"0.05": 90.0, "0.5": 100.0, "0.95": 120.0}  # upside=20, downside=10
        assert distribution_skew(p) > 0

    def test_negative_skew_when_downside_larger(self):
        """Skew < 0 when downside tail is larger than upside."""
        p = {"0.05": 80.0, "0.5": 100.0, "0.95": 110.0}  # upside=10, downside=20
        assert distribution_skew(p) < 0

    def test_zero_skew_symmetric(self):
        """Skew ~0 for symmetric distribution."""
        p = {"0.05": 90.0, "0.5": 100.0, "0.95": 110.0}
        assert abs(distribution_skew(p)) < 0.01

    def test_skew_bounded(self):
        """Skew should be between -1 and 1."""
        p = {"0.05": 50.0, "0.5": 100.0, "0.95": 110.0}
        skew = distribution_skew(p)
        assert -1.0 <= skew <= 1.0


# ──────────────────────────────────────────────────────────────────
# distribution_kurtosis
# ──────────────────────────────────────────────────────────────────

class TestDistributionKurtosis:
    def test_reasonable_range(self, last_percentiles):
        """Kurtosis proxy (tail/body ratio) should be positive and finite."""
        k = distribution_kurtosis(last_percentiles)
        assert k > 0
        assert math.isfinite(k)

    def test_fat_tails_higher_kurtosis(self):
        """Wider 0.5%/99.5% tails relative to 20/80 body = higher kurtosis."""
        thin_tails = {"0.005": 95.0, "0.2": 98.0, "0.8": 102.0, "0.995": 105.0}
        fat_tails = {"0.005": 80.0, "0.2": 98.0, "0.8": 102.0, "0.995": 120.0}
        assert distribution_kurtosis(fat_tails) > distribution_kurtosis(thin_tails)


# ──────────────────────────────────────────────────────────────────
# detect_regime
# ──────────────────────────────────────────────────────────────────

class TestDetectRegime:
    def test_low_vol_grind(self):
        """Tight range (<1.5%) triggers LOW_VOL_GRIND."""
        price = 100.0
        p = {"0.005": 99.0, "0.05": 99.3, "0.2": 99.5, "0.35": 99.7,
             "0.5": 100.0, "0.65": 100.3, "0.8": 100.5, "0.95": 100.7, "0.995": 101.0}
        result = detect_regime(p, price)
        assert result["regime"] == MarketRegime.LOW_VOL_GRIND.value

    def test_high_vol_trend(self):
        """Wide range (>3%) with directional bias triggers HIGH_VOL_TREND."""
        price = 100.0
        p = {"0.005": 93.0, "0.05": 95.0, "0.2": 97.0, "0.35": 98.5,
             "0.5": 101.0, "0.65": 102.5, "0.8": 104.0, "0.95": 106.0, "0.995": 108.0}
        # range = (106-95)/100 = 0.11, median_move = (101-100)/100 = 0.01
        result = detect_regime(p, price)
        assert result["regime"] == MarketRegime.HIGH_VOL_TREND.value

    def test_tail_risk(self, tail_risk_response):
        """Extreme kurtosis + wide range triggers TAIL_RISK."""
        p = get_last_percentiles(tail_risk_response)
        price = tail_risk_response["current_price"]
        result = detect_regime(p, price)
        assert result["regime"] == MarketRegime.TAIL_RISK.value

    def test_mean_reversion_fallback(self):
        """Moderate range, no strong direction => MEAN_REVERSION."""
        price = 100.0
        p = {"0.005": 96.0, "0.05": 97.0, "0.2": 98.5, "0.35": 99.2,
             "0.5": 100.0, "0.65": 100.8, "0.8": 101.5, "0.95": 103.0, "0.995": 104.0}
        # range = (103-97)/100 = 0.06 > 0.03 but median_move=0 < 0.005
        result = detect_regime(p, price)
        assert result["regime"] == MarketRegime.MEAN_REVERSION.value

    def test_regime_has_required_fields(self, last_percentiles):
        result = detect_regime(last_percentiles, 71007.68)
        assert "regime" in result
        assert "description" in result
        assert "vol_range" in result
        assert "skew" in result
        assert "kurtosis_proxy" in result
        assert "median_move_pct" in result


# ──────────────────────────────────────────────────────────────────
# kelly_from_synth
# ──────────────────────────────────────────────────────────────────

class TestKellyFromSynth:
    def test_kelly_non_negative(self, last_percentiles):
        """Kelly fraction should never be negative."""
        result = kelly_from_synth(
            last_percentiles, 71007.68,
            entry_price=71007.68, take_profit=72000.0, stop_loss=70000.0,
        )
        assert result["kelly_fraction"] >= 0

    def test_kelly_reasonable_sizing(self, last_percentiles):
        """With half-Kelly, position should be moderate (< 50%)."""
        result = kelly_from_synth(
            last_percentiles, 71007.68,
            entry_price=71007.68, take_profit=72000.0, stop_loss=70000.0,
            fraction=0.5,
        )
        assert result["recommended_position_pct"] <= 50.0

    def test_kelly_probabilities_sum_to_one(self, last_percentiles):
        """Win + loss probabilities should sum to 1."""
        result = kelly_from_synth(
            last_percentiles, 71007.68,
            entry_price=71007.68, take_profit=72000.0, stop_loss=70000.0,
        )
        total = result["win_probability"] + result["loss_probability"]
        assert abs(total - 1.0) < 0.01

    def test_kelly_short_direction(self, last_percentiles):
        """Short Kelly should work and return valid results."""
        result = kelly_from_synth(
            last_percentiles, 71007.68,
            entry_price=71007.68, take_profit=70000.0, stop_loss=72000.0,
            direction="short",
        )
        assert result["kelly_fraction"] >= 0
        assert result["avg_win_pct"] > 0
        assert result["avg_loss_pct"] > 0

    def test_kelly_has_all_fields(self, last_percentiles):
        result = kelly_from_synth(
            last_percentiles, 71007.68,
            entry_price=71007.68, take_profit=72000.0, stop_loss=70000.0,
        )
        required = {"kelly_fraction", "win_probability", "loss_probability",
                     "avg_win_pct", "avg_loss_pct", "recommended_position_pct"}
        assert required.issubset(result.keys())


# ──────────────────────────────────────────────────────────────────
# liquidation_probability
# ──────────────────────────────────────────────────────────────────

class TestLiquidationProbability:
    def test_monotonic_increasing(self, last_percentiles):
        """Higher liquidation price (closer to current) = higher probability for longs."""
        # Liq prices ascending (closer to current = more likely to get hit)
        liq_prices = [70850.0, 70900.0, 70950.0, 71000.0]
        probs = [liquidation_probability(last_percentiles, lp) for lp in liq_prices]
        for i in range(len(probs) - 1):
            assert probs[i] <= probs[i + 1], (
                f"Not monotonic: prob({liq_prices[i]})={probs[i]} > "
                f"prob({liq_prices[i+1]})={probs[i+1]}"
            )

    def test_very_low_liq_gives_low_prob(self, last_percentiles):
        """Liquidation price far below all percentiles should give prob near 0."""
        prob = liquidation_probability(last_percentiles, 60000.0)
        assert prob < 0.01

    def test_very_high_liq_gives_high_prob(self, last_percentiles):
        """Liquidation price above all percentiles should give prob = 1.0."""
        prob = liquidation_probability(last_percentiles, 80000.0)
        assert prob == 1.0

    def test_mid_range_liq(self, last_percentiles):
        """Liq price near median should give prob ~0.5."""
        p50 = last_percentiles["0.5"]
        prob = liquidation_probability(last_percentiles, p50)
        assert 0.4 <= prob <= 0.6


# ──────────────────────────────────────────────────────────────────
# compute_derived_metrics
# ──────────────────────────────────────────────────────────────────

class TestComputeDerivedMetrics:
    def test_all_fields_present(self, btc_synth_response):
        result = compute_derived_metrics(btc_synth_response, "BTC", "24h")
        required = {
            "asset", "horizon", "current_price", "implied_vol_annualized",
            "up_probability", "direction", "conviction", "median_forecast",
            "skew", "kurtosis_proxy", "regime", "regime_description",
            "tail_risk", "updated_at",
        }
        assert required.issubset(result.keys()), f"Missing: {required - set(result.keys())}"

    def test_returns_error_on_empty_data(self):
        result = compute_derived_metrics({}, "BTC", "24h")
        assert "error" in result

    def test_returns_error_on_missing_percentiles(self):
        result = compute_derived_metrics({"current_price": 70000}, "BTC", "24h")
        assert "error" in result

    def test_tail_risk_sub_fields(self, btc_synth_response):
        result = compute_derived_metrics(btc_synth_response, "BTC", "24h")
        tail = result["tail_risk"]
        assert "prob_2pct_drop" in tail
        assert "prob_5pct_drop" in tail
        assert "prob_10pct_drop" in tail


# ──────────────────────────────────────────────────────────────────
# tail_risk_metrics
# ──────────────────────────────────────────────────────────────────

class TestTailRiskMetrics:
    def test_larger_drop_lower_probability(self, last_percentiles):
        """Probability of a 10% drop should be <= prob of 5% drop <= prob of 2% drop."""
        result = tail_risk_metrics(last_percentiles, 71007.68)
        assert result["prob_10pct_drop"] <= result["prob_5pct_drop"]
        assert result["prob_5pct_drop"] <= result["prob_2pct_drop"]

    def test_probabilities_bounded(self, last_percentiles):
        result = tail_risk_metrics(last_percentiles, 71007.68)
        for key in ["prob_2pct_drop", "prob_5pct_drop", "prob_10pct_drop"]:
            assert 0.0 <= result[key] <= 1.0


# ──────────────────────────────────────────────────────────────────
# get_last_percentiles
# ──────────────────────────────────────────────────────────────────

class TestGetLastPercentiles:
    def test_returns_last_timestep(self, btc_synth_response):
        p = get_last_percentiles(btc_synth_response)
        assert "0.5" in p
        assert p["0.5"] == 71005.66

    def test_empty_on_missing_data(self):
        assert get_last_percentiles({}) == {}
        assert get_last_percentiles({"forecast_future": {}}) == {}
        assert get_last_percentiles({"forecast_future": {"percentiles": []}}) == {}
