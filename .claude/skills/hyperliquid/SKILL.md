# SKILL: Hyperliquid Integration

## Overview
How to integrate Hyperliquid trading capabilities into SynthEdge.

## SDK Setup
```bash
pip install hyperliquid-python-sdk
```

## Key Classes

### Info (Read-only — used by backend)
```python
from hyperliquid.info import Info
from hyperliquid.utils import constants

info = Info(constants.MAINNET_API_URL, skip_ws=True)

# Get user's open positions
user_state = info.user_state("0xYOUR_ADDRESS")
# Returns: marginSummary, crossMarginSummary, assetPositions[]

# Get all mid prices
all_mids = info.all_mids()
# Returns: {"BTC": "84500.0", "ETH": "3200.0", ...}

# Get metadata (asset list, decimals, leverage limits)
meta = info.meta()
# Returns: universe[] with name, szDecimals, maxLeverage

# Get funding rates
funding = info.funding_history("BTC", start_time_ms)

# Get open orders
orders = info.open_orders("0xYOUR_ADDRESS")

# Get user fills (trade history)
fills = info.user_fills("0xYOUR_ADDRESS")
```

### Exchange (Write — used by FRONTEND only, client-side signing)
```python
from hyperliquid.exchange import Exchange
from eth_account import Account

wallet = Account.from_key("0xUSER_API_PRIVATE_KEY")
exchange = Exchange(wallet, constants.MAINNET_API_URL)

# Place limit order
result = exchange.order("BTC", is_buy=True, sz=0.01, limit_px=84000.0, 
                        order_type={"limit": {"tif": "Gtc"}})

# Place market order (use high slippage limit price)
result = exchange.market_open("BTC", is_buy=True, sz=0.01)

# Close position
result = exchange.market_close("BTC")

# Cancel order
result = exchange.cancel("BTC", oid=order_id)
```

## CRITICAL: Client-Side Only Execution

**NEVER** send the user's Hyperliquid private key to the backend.

Frontend execution flow:
1. User enters HL API private key in browser (stored in memory/sessionStorage only)
2. Frontend constructs order parameters
3. Frontend signs the order using ethers.js / viem
4. Frontend sends signed payload directly to `https://api.hyperliquid.xyz`
5. Backend is NOT involved in execution

For the frontend, use the TypeScript SDK or raw HTTP:
```typescript
// Frontend: Direct HTTP to Hyperliquid
const response = await fetch("https://api.hyperliquid.xyz/exchange", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: signedAction,
    nonce: Date.now(),
    signature: signature,
    vaultAddress: null
  })
});
```

TypeScript community SDKs:
- https://github.com/nktkas/hyperliquid
- https://github.com/nomeida/hyperliquid
- CCXT: https://docs.ccxt.com/#/exchanges/hyperliquid

## HIP-3 Equity Perps

Equity perps (NVDA, TSLA, AAPL, GOOGL) are HIP-3 "builder-deployed" markets.
They have different asset indices than native perps.

To get the correct asset index:
```python
meta = info.meta()
for i, asset in enumerate(meta["universe"]):
    if asset["name"] == "NVDA":
        print(f"NVDA index: {i}")
```

HIP-3 markets may also be available via trade.xyz or Felix Protocol.
Some trade in USDC, others in USDH.

## Useful Info Endpoints

### User State (Portfolio)
```python
state = info.user_state(address)
# state["assetPositions"] → list of open positions
# Each position: {"position": {"coin", "szi", "entryPx", "leverage", "liquidationPx", ...}}
# state["marginSummary"] → {"accountValue", "totalMarginUsed", "totalNtlPos", ...}
# state["crossMarginSummary"] → cross-margin details
```

### Funding Rates
```python
# Current predicted funding rates
funding_rates = info.predicted_fundings()
# Returns list of {"coin": "BTC", "funding": "0.00012", ...}

# Historical funding
history = info.funding_history("BTC", start_time_ms=int(time.time()*1000) - 86400000)
```

### Orderbook
```python
book = info.l2_snapshot("BTC")
# {"levels": [{"px": "84500.0", "sz": "1.2", "n": 3}, ...]}
```

## WebSocket (Real-time from backend)
```python
from hyperliquid.info import Info

info = Info(constants.MAINNET_API_URL, skip_ws=False)

# Subscribe to trades
def on_trade(data):
    print(data)

info.subscribe({"type": "trades", "coin": "BTC"}, on_trade)

# Subscribe to user fills
info.subscribe({"type": "userFills", "user": address}, on_fills)
```

## Mapping Synth Assets to Hyperliquid

| Synth Asset | Hyperliquid Perp | Type |
|-------------|-----------------|------|
| BTC | BTC | Native |
| ETH | ETH | Native |
| SOL | SOL | Native |
| XAU | XAU (if available) | HIP-3 |
| SPYX | SPY | HIP-3 |
| NVDAX | NVDA | HIP-3 |
| TSLAX | TSLA | HIP-3 |
| AAPLX | AAPL | HIP-3 |
| GOOGLX | GOOGL | HIP-3 |

## Availability Note
Hyperliquid is NOT available in: USA, UK, Ontario (Canada), Belgium, sanctioned countries.
Display a clear disclaimer in the UI.
