# SKILL: Security & Key Management

## Core Principle
SynthEdge handles two sensitive credentials: Synth API key and Hyperliquid wallet private key. Neither should ever be stored in plaintext on the backend or transmitted unnecessarily.

## Hyperliquid Private Key (HIGHEST SENSITIVITY)

### Rules
- **NEVER** send to backend. Not in headers, not in body, not encrypted, NEVER.
- Stored in browser `sessionStorage` only (cleared on tab close)
- All order signing happens client-side using viem/ethers
- Frontend sends signed payloads directly to `https://api.hyperliquid.xyz`
- Backend can read user's public data (positions, fills) using their public address only

### Frontend Implementation
```typescript
// stores/useWalletStore.ts
import { create } from 'zustand'

interface WalletState {
  address: string | null
  // Private key lives ONLY in closure, not in state
  getPrivateKey: () => string | null
  connect: (apiPrivateKey: string) => void
  disconnect: () => void
}

export const useWalletStore = create<WalletState>((set) => {
  let _privateKey: string | null = null  // Closure, not serializable
  
  return {
    address: null,
    getPrivateKey: () => _privateKey,
    connect: (apiPrivateKey: string) => {
      // Derive address from private key
      const wallet = new ethers.Wallet(apiPrivateKey)
      _privateKey = apiPrivateKey
      sessionStorage.setItem('hl_connected', 'true')  // Flag only, not key
      set({ address: wallet.address })
    },
    disconnect: () => {
      _privateKey = null
      sessionStorage.removeItem('hl_connected')
      set({ address: null })
    },
  }
})
```

## Synth API Key (MEDIUM SENSITIVITY)

### Two Modes

**Mode A: Frontend-only (simplest, recommended for hackathon)**
- User enters Synth API key in frontend
- Frontend stores in `localStorage` (persists across sessions)
- Frontend proxies to backend with key in request header
- Backend uses key for Synth API calls, never stores it
- Pro: No backend storage of keys
- Con: Every request includes the key

**Mode B: Backend-encrypted storage (production)**
- User submits key once
- Backend encrypts with AES-256-GCM using server-side ENCRYPTION_KEY
- Stored in PostgreSQL `users.synth_api_key_encrypted`
- Backend decrypts per-request for Synth API calls
- Pro: User doesn't resend key every time
- Con: Backend holds encrypted key

### For Hackathon: Use Mode A
```typescript
// Frontend: pass Synth key as header
const synthKey = localStorage.getItem('synth_api_key')

const response = await fetch(`${API_URL}/api/synth/percentiles?asset=BTC&horizon=24h`, {
  headers: {
    'X-Synth-Api-Key': synthKey,
  }
})
```

```python
# Backend: extract and use, don't store
@router.get("/api/synth/percentiles")
async def get_percentiles(
    asset: str,
    horizon: str = "24h",
    synth_key: str = Header(alias="X-Synth-Api-Key")
):
    # Use key for this request only
    data = await synth_service.fetch_percentiles(asset, horizon, api_key=synth_key)
    return data
```

## CORS Configuration
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),  # "http://localhost:3000" in dev
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

## Rate Limiting
```python
# Protect against API key abuse
from fastapi import Request
import redis.asyncio as redis

async def rate_limit(request: Request, max_per_minute: int = 30):
    key = f"ratelimit:{request.client.host}"
    current = await redis_client.incr(key)
    if current == 1:
        await redis_client.expire(key, 60)
    if current > max_per_minute:
        raise HTTPException(429, "Rate limit exceeded")
```

## Disclaimers (MUST include in UI)

1. **Trading risk:** "Trading involves substantial risk of loss. Past performance is not indicative of future results."
2. **Not financial advice:** "SynthEdge provides probabilistic analytics for informational purposes only. Not financial advice."
3. **Availability:** "Hyperliquid is not available in: USA, UK, Ontario (Canada), Belgium, and sanctioned countries."
4. **Key security:** "Your Hyperliquid API key never leaves your browser. Your Synth API key is used for data access only."
5. **Synth accuracy:** "Synth forecasts are probabilistic estimates, not guarantees. Always manage risk appropriately."
