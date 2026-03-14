# SKILL: Testing & Quality

## Backend Testing (pytest)

```bash
cd backend
pytest                          # Run all
pytest -x                       # Stop on first failure
pytest -k "test_synth"          # Run matching tests
pytest --cov=app                # Coverage report
```

### Test Structure
```
backend/tests/
├── conftest.py                 # Shared fixtures (async client, mock Redis, etc.)
├── test_synth_service.py       # Synth API polling, caching, derivation
├── test_analytics.py           # VaR, Kelly, regime, skew, kurtosis
├── test_hl_service.py          # Hyperliquid data reads
├── test_portfolio.py           # Portfolio aggregation
├── test_routers/
│   ├── test_synth_router.py    # API endpoint tests
│   ├── test_analytics_router.py
│   └── test_portfolio_router.py
└── fixtures/
    ├── synth_response.json     # Mock Synth API response
    └── hl_state.json           # Mock Hyperliquid user state
```

### Key Fixtures
```python
# conftest.py
import pytest
import json
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.fixture
def synth_percentiles():
    with open("tests/fixtures/synth_response.json") as f:
        return json.load(f)

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

@pytest.fixture
def mock_redis(mocker):
    """Mock Redis to return cached Synth data."""
    mock = mocker.patch("app.services.cache_service.redis_client")
    return mock
```

### Testing Derivations (Critical)
```python
# test_analytics.py
def test_implied_vol_from_percentiles():
    p = {"0.05": 83000, "0.95": 87000}
    current = 85000
    vol = implied_vol_from_percentiles(p, current, horizon_hours=24)
    assert 0.1 < vol < 2.0  # Sanity check annualized vol

def test_directional_probability_bullish():
    p = {"0.35": 84500, "0.5": 85200, "0.65": 85800}
    result = directional_probability(p, current_price=84000)
    assert result["lean"] == "bullish"

def test_kelly_no_negative():
    """Kelly should never recommend negative position."""
    result = kelly_fraction(win_probability=0.3, avg_win_pct=0.02, avg_loss_pct=0.05)
    assert result >= 0

def test_regime_detection_tail_risk():
    p = {"0.005": 70000, "0.05": 78000, "0.2": 82000, "0.35": 83500,
         "0.5": 84500, "0.65": 85500, "0.8": 87000, "0.95": 92000, "0.995": 100000}
    result = detect_regime(p, 84500)
    assert result["regime"] == "tail_risk"
```

## Frontend Testing

### Type Checking
```bash
cd frontend
npm run type-check   # tsc --noEmit
```

### Linting
```bash
npm run lint         # ESLint
```

### Component Testing (Playwright for E2E)
```bash
npx playwright test
```

Focus E2E tests on:
1. Wallet connection flow
2. Asset selection + probability cone rendering
3. Trade panel interaction
4. Portfolio view loads positions

## Manual QA Checklist (Pre-Demo)

### Core Flow
- [ ] Landing page loads, Synth API key input works
- [ ] Dashboard shows all 9 assets with directional probabilities
- [ ] Clicking asset opens deep-dive with probability cone
- [ ] Probability cone shows 5 bands with real-time price overlay
- [ ] Volatility heatmap renders correctly
- [ ] Switching 1h ↔ 24h updates all views

### Trading Flow
- [ ] Hyperliquid wallet connects (API key input)
- [ ] Portfolio shows existing positions
- [ ] Trade panel opens with pre-filled Kelly size
- [ ] Long/Short execution works
- [ ] Position appears in portfolio after fill
- [ ] Trade logged in journal with Synth context

### Risk Features
- [ ] VaR gauge shows portfolio risk
- [ ] Liquidation Guardian shows risk for leveraged positions
- [ ] Alerts trigger when thresholds breached
- [ ] Regime indicator updates with market conditions

### Edge Cases
- [ ] Invalid Synth API key → clear error message
- [ ] Synth API down → graceful degradation (show stale data with warning)
- [ ] Hyperliquid disconnected → read-only mode (no trade panel)
- [ ] WebSocket reconnects after disconnect
- [ ] No positions → empty state, not error

## Demo Video Checklist (1 min)

1. (0:00-0:10) Landing page → Enter Synth API key → Connect HL wallet
2. (0:10-0:25) Dashboard overview: scanner, heatmap, cones
3. (0:25-0:40) Asset deep-dive: NVDA probability cone, regime, risk
4. (0:40-0:50) Execute trade: Kelly size → Long NVDA → Confirm
5. (0:50-0:60) Portfolio view: position + VaR + journal entry
