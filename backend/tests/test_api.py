"""Tests for FastAPI API endpoints using httpx AsyncClient.

Tests health, scanner, derived, kelly, insights/cross-asset-vol,
and insights/distribution endpoints.
"""

import json
from unittest.mock import patch, AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from tests.conftest import FakeRedis, _make_synth_response, _null_lifespan


# ---------------------------------------------------------------------------
# Helpers to build a fully-populated FakeRedis for API tests
# ---------------------------------------------------------------------------

def _build_populated_redis() -> FakeRedis:
    """Build a FakeRedis with BTC data cached for both 24h and 1h."""
    from app.core.derivations import compute_derived_metrics

    redis = FakeRedis()
    for horizon in ["24h", "1h"]:
        resp = _make_synth_response()
        raw_json = json.dumps(resp)
        derived = compute_derived_metrics(resp, "BTC", horizon)
        derived_json = json.dumps(derived)
        redis._store[f"synth:BTC:{horizon}"] = raw_json
        redis._store[f"derived:BTC:{horizon}"] = derived_json

    redis._store["synth:last_update"] = "1710460500.0"
    return redis


@pytest_asyncio.fixture
async def api_client():
    """Standalone API client with its own populated Redis."""
    fake_redis = _build_populated_redis()

    async def _mock_get_redis():
        return fake_redis

    with patch("app.services.synth_service.get_redis", _mock_get_redis), \
         patch("app.services.synth_service.redis_client", fake_redis), \
         patch("app.services.hl_service.get_user_state", return_value={
             "assetPositions": [{
                 "position": {
                     "coin": "BTC",
                     "szi": "0.1",
                     "entryPx": "70000",
                     "liquidationPx": "65000",
                     "leverage": {"type": "cross", "value": "5"},
                     "unrealizedPnl": "100.50",
                 }
             }],
             "marginSummary": {
                 "accountValue": "10000",
                 "totalMarginUsed": "1400",
                 "totalNtlPos": "7000",
             },
         }):
        from app.main import app
        app.router.lifespan_context = _null_lifespan
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


# ──────────────────────────────────────────────────────────────────
# Health endpoint
# ──────────────────────────────────────────────────────────────────

class TestHealth:
    @pytest.mark.asyncio
    async def test_health_returns_200(self, api_client):
        resp = await api_client.get("/api/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "services" in body
        assert "polling" in body


# ──────────────────────────────────────────────────────────────────
# Scanner endpoint
# ──────────────────────────────────────────────────────────────────

class TestScanner:
    @pytest.mark.asyncio
    async def test_scanner_returns_list(self, api_client):
        resp = await api_client.get("/api/analytics/scanner?horizon=24h")
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert isinstance(body["data"], list)

    @pytest.mark.asyncio
    async def test_scanner_btc_present(self, api_client):
        resp = await api_client.get("/api/analytics/scanner?horizon=24h")
        body = resp.json()
        assets = [item["asset"] for item in body["data"]]
        assert "BTC" in assets

    @pytest.mark.asyncio
    async def test_scanner_item_fields(self, api_client):
        resp = await api_client.get("/api/analytics/scanner?horizon=24h")
        body = resp.json()
        if body["data"]:
            item = body["data"][0]
            required = {"asset", "current_price", "direction", "up_probability",
                        "implied_vol", "regime", "conviction", "skew"}
            assert required.issubset(item.keys())


# ──────────────────────────────────────────────────────────────────
# Derived endpoint
# ──────────────────────────────────────────────────────────────────

class TestDerived:
    @pytest.mark.asyncio
    async def test_derived_btc_24h(self, api_client):
        resp = await api_client.get("/api/analytics/derived?asset=BTC&horizon=24h")
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert body["data"]["asset"] == "BTC"
        assert body["data"]["horizon"] == "24h"

    @pytest.mark.asyncio
    async def test_derived_missing_asset(self, api_client):
        resp = await api_client.get("/api/analytics/derived?asset=DOGE&horizon=24h")
        assert resp.status_code == 200
        body = resp.json()
        assert "error" in body


# ──────────────────────────────────────────────────────────────────
# Kelly endpoint
# ──────────────────────────────────────────────────────────────────

class TestKelly:
    @pytest.mark.asyncio
    async def test_kelly_valid_request(self, api_client):
        resp = await api_client.post("/api/analytics/kelly", json={
            "asset": "BTC",
            "direction": "long",
            "entry": 71007.68,
            "tp": 72000.0,
            "sl": 70000.0,
            "horizon": "24h",
            "fraction": 0.5,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        data = body["data"]
        assert data["kelly_fraction"] >= 0
        assert 0 <= data["win_probability"] <= 1
        assert 0 <= data["loss_probability"] <= 1

    @pytest.mark.asyncio
    async def test_kelly_missing_asset(self, api_client):
        resp = await api_client.post("/api/analytics/kelly", json={
            "asset": "DOGE",
            "entry": 0.1,
            "tp": 0.2,
            "sl": 0.05,
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "error" in body


# ──────────────────────────────────────────────────────────────────
# Cross-asset volatility
# ──────────────────────────────────────────────────────────────────

class TestCrossAssetVol:
    @pytest.mark.asyncio
    async def test_cross_asset_vol_structure(self, api_client):
        resp = await api_client.get("/api/insights/cross-asset-vol")
        assert resp.status_code == 200
        body = resp.json()
        assert "data" in body
        assert "assets" in body["data"]
        assert isinstance(body["data"]["assets"], list)

    @pytest.mark.asyncio
    async def test_cross_asset_vol_btc_has_data(self, api_client):
        resp = await api_client.get("/api/insights/cross-asset-vol")
        body = resp.json()
        btc_rows = [a for a in body["data"]["assets"] if a["asset"] == "BTC"]
        assert len(btc_rows) == 1
        btc = btc_rows[0]
        assert btc["class"] == "crypto"
        # 24h vol should exist since we cached it
        assert btc["vol_24h"] is not None


# ──────────────────────────────────────────────────────────────────
# Distribution analysis
# ──────────────────────────────────────────────────────────────────

class TestDistribution:
    @pytest.mark.asyncio
    async def test_distribution_btc_24h(self, api_client):
        resp = await api_client.get("/api/insights/distribution?asset=BTC&horizon=24h")
        assert resp.status_code == 200
        body = resp.json()
        data = body["data"]
        assert data["asset"] == "BTC"
        assert data["horizon"] == "24h"
        assert "percentile_prices" in data
        assert "percentile_returns_pct" in data
        assert "probability_bands" in data
        assert "confidence_intervals" in data
        assert "skew_analysis" in data

    @pytest.mark.asyncio
    async def test_distribution_missing_asset(self, api_client):
        resp = await api_client.get("/api/insights/distribution?asset=DOGE&horizon=24h")
        assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────────
# Liquidation risk endpoint
# ──────────────────────────────────────────────────────────────────

class TestLiquidationRisk:
    @pytest.mark.asyncio
    async def test_liquidation_risk_long(self, api_client):
        resp = await api_client.get(
            "/api/analytics/liquidation-risk",
            params={
                "asset": "BTC",
                "entry_price": 71000,
                "leverage": 10,
                "direction": "long",
                "horizon": "24h",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        data = body["data"]
        assert data["asset"] == "BTC"
        assert data["leverage"] == 10
        assert 0 <= data["liquidation_probability"] <= 1
        # Long liq price should be below entry
        assert data["liquidation_price"] < 71000

    @pytest.mark.asyncio
    async def test_liquidation_risk_short(self, api_client):
        resp = await api_client.get(
            "/api/analytics/liquidation-risk",
            params={
                "asset": "BTC",
                "entry_price": 71000,
                "leverage": 10,
                "direction": "short",
                "horizon": "24h",
            },
        )
        assert resp.status_code == 200
        body = resp.json()
        data = body["data"]
        # Short liq price should be above entry
        assert data["liquidation_price"] > 71000


# ──────────────────────────────────────────────────────────────────
# Portfolio positions
# ──────────────────────────────────────────────────────────────────

class TestPortfolio:
    @pytest.mark.asyncio
    async def test_portfolio_positions(self, api_client):
        resp = await api_client.get(
            "/api/portfolio/positions",
            params={"address": "0xTestAddress", "horizon": "24h"},
        )
        assert resp.status_code == 200
        body = resp.json()
        data = body["data"]
        assert "positions" in data
        assert "margin_summary" in data
        assert data["position_count"] == 1
        pos = data["positions"][0]
        assert pos["asset"] == "BTC"
        assert pos["direction"] == "long"
        assert pos["size"] == 0.1
