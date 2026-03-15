"""Shared fixtures for SynthEdge backend tests."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


# ---------------------------------------------------------------------------
# Realistic Synth API response data
# ---------------------------------------------------------------------------

def _make_synth_response(
    current_price: float = 71007.68,
    p005: float = 70877.44,
    p05: float = 70923.83,
    p20: float = 70963.01,
    p35: float = 70986.39,
    p50: float = 71005.66,
    p65: float = 71025.18,
    p80: float = 71049.04,
    p95: float = 71090.32,
    p995: float = 71135.14,
    num_timesteps: int = 289,
) -> dict:
    """Build a realistic Synth prediction-percentiles response.

    The first timestep is near current price, the last timestep shows the
    full forecast spread.  Intermediate timesteps interpolate linearly.
    """
    first = {
        "0.005": current_price - 1,
        "0.05": current_price - 0.5,
        "0.2": current_price - 0.2,
        "0.35": current_price - 0.1,
        "0.5": current_price,
        "0.65": current_price + 0.1,
        "0.8": current_price + 0.2,
        "0.95": current_price + 0.5,
        "0.995": current_price + 1,
    }
    last = {
        "0.005": p005,
        "0.05": p05,
        "0.2": p20,
        "0.35": p35,
        "0.5": p50,
        "0.65": p65,
        "0.8": p80,
        "0.95": p95,
        "0.995": p995,
    }
    # Build timesteps array (only first and last matter for tests)
    percentiles = [first]
    for _ in range(num_timesteps - 2):
        percentiles.append(first)  # filler
    percentiles.append(last)

    return {
        "current_price": current_price,
        "forecast_future": {"percentiles": percentiles},
        "forecast_start_time": "2026-03-14T23:15:00+00:00",
    }


@pytest.fixture
def btc_synth_response() -> dict:
    """BTC 24h response — slight bullish lean (p50 < current but close)."""
    return _make_synth_response()


@pytest.fixture
def btc_bullish_response() -> dict:
    """BTC with clearly bullish forecast (median well above current)."""
    return _make_synth_response(
        current_price=70000.0,
        p005=69500.0,
        p05=69700.0,
        p20=69900.0,
        p35=70100.0,
        p50=70500.0,  # median > current => bullish
        p65=70900.0,
        p80=71200.0,
        p95=71600.0,
        p995=72000.0,
    )


@pytest.fixture
def btc_bearish_response() -> dict:
    """BTC with clearly bearish forecast (median below current)."""
    return _make_synth_response(
        current_price=72000.0,
        p005=70000.0,
        p05=70500.0,
        p20=71000.0,
        p35=71300.0,
        p50=71500.0,  # median < current => bearish
        p65=71700.0,
        p80=71900.0,
        p95=72200.0,
        p995=72500.0,
    )


@pytest.fixture
def high_vol_response() -> dict:
    """Wide-spread percentiles for high volatility regime."""
    return _make_synth_response(
        current_price=70000.0,
        p005=65000.0,
        p05=66000.0,
        p20=67500.0,
        p35=68500.0,
        p50=70500.0,  # slight bullish
        p65=71500.0,
        p80=73000.0,
        p95=74500.0,
        p995=76000.0,
    )


@pytest.fixture
def tail_risk_response() -> dict:
    """Extreme tails — triggers TAIL_RISK regime."""
    return _make_synth_response(
        current_price=70000.0,
        p005=60000.0,  # extreme tails
        p05=63000.0,
        p20=68000.0,
        p35=69000.0,
        p50=70500.0,
        p65=71000.0,
        p80=72000.0,
        p95=77000.0,
        p995=80000.0,  # extreme tails
    )


@pytest.fixture
def last_percentiles() -> dict[str, float]:
    """Last-timestep percentiles for direct derivation testing."""
    return {
        "0.005": 70877.44,
        "0.05": 70923.83,
        "0.2": 70963.01,
        "0.35": 70986.39,
        "0.5": 71005.66,
        "0.65": 71025.18,
        "0.8": 71049.04,
        "0.95": 71090.32,
        "0.995": 71135.14,
    }


# ---------------------------------------------------------------------------
# Mock Redis
# ---------------------------------------------------------------------------

class FakeRedis:
    """In-memory Redis mock supporting get/set/setex/ping/pipeline."""

    def __init__(self):
        self._store: dict[str, str] = {}

    async def ping(self):
        return True

    async def get(self, key: str):
        return self._store.get(key)

    async def set(self, key: str, value: str):
        self._store[key] = value

    async def setex(self, key: str, ttl: int, value: str):
        self._store[key] = value  # ignore TTL for tests

    def pipeline(self):
        return FakePipeline(self)


class FakePipeline:
    def __init__(self, redis: FakeRedis):
        self._redis = redis
        self._ops: list = []

    def setex(self, key, ttl, value):
        self._ops.append(("setex", key, ttl, value))
        return self

    def set(self, key, value):
        self._ops.append(("set", key, value))
        return self

    async def execute(self):
        for op in self._ops:
            if op[0] == "setex":
                self._redis._store[op[1]] = op[3]
            elif op[0] == "set":
                self._redis._store[op[1]] = op[2]
        self._ops.clear()


@pytest.fixture
def fake_redis():
    return FakeRedis()


# ---------------------------------------------------------------------------
# Pre-populated Redis (with cached synth + derived data)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def populated_redis(fake_redis, btc_synth_response):
    """FakeRedis with BTC 24h data pre-cached."""
    from app.core.derivations import compute_derived_metrics

    raw_json = json.dumps(btc_synth_response)
    derived = compute_derived_metrics(btc_synth_response, "BTC", "24h")
    derived_json = json.dumps(derived)

    fake_redis._store["synth:BTC:24h"] = raw_json
    fake_redis._store["derived:BTC:24h"] = derived_json
    fake_redis._store["synth:last_update"] = "1710460500.0"
    return fake_redis


# ---------------------------------------------------------------------------
# FastAPI test client with mocked Redis + HL
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def client(populated_redis):
    """AsyncClient that talks to the FastAPI app with mocked services."""
    # Patch Redis before importing the app
    with patch("app.services.synth_service.get_redis", new_callable=lambda: lambda: AsyncMock(return_value=populated_redis)):
        # Also patch at router level since they call get_cached_*
        async def _mock_get_redis():
            return populated_redis

        with patch("app.services.synth_service.get_redis", _mock_get_redis), \
             patch("app.services.synth_service.redis_client", populated_redis), \
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
            # Import app after patches are in place
            from app.main import app

            # Disable lifespan (no polling in tests)
            app.router.lifespan_context = _null_lifespan

            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as ac:
                yield ac


from contextlib import asynccontextmanager

@asynccontextmanager
async def _null_lifespan(app):
    yield
