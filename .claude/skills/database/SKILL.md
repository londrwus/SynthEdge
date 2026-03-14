# SKILL: Database — PostgreSQL + Redis (Simplified)

## No MongoDB. Just two stores.

### Redis 7 — Hot cache (ephemeral)
```
synth:{asset}:{horizon}     → Raw percentiles JSON, TTL=55s
derived:{asset}:{horizon}   → Derived metrics JSON, TTL=55s
hl:mids                     → All Hyperliquid mid prices, TTL=5s
hl:funding                  → Funding rates, TTL=60s
hl:user:{address}:state     → User position state, TTL=10s
```

### PostgreSQL 16 — Persistent data
Everything in `init.sql` — no Alembic for hackathon.

### init.sql
```sql
-- Run once on first docker-compose up (mounted to entrypoint)

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hl_address VARCHAR(42) NOT NULL,
    asset VARCHAR(10) NOT NULL,
    direction VARCHAR(5) NOT NULL,
    entry_price DECIMAL(20,8) NOT NULL,
    exit_price DECIMAL(20,8),
    size DECIMAL(20,8) NOT NULL,
    leverage DECIMAL(5,2) DEFAULT 1.0,
    pnl DECIMAL(20,8),
    synth_up_prob DECIMAL(5,4),
    synth_vol DECIMAL(10,4),
    synth_regime VARCHAR(30),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_address ON journal_entries(hl_address);

CREATE TABLE IF NOT EXISTS forecast_snapshots (
    id BIGSERIAL PRIMARY KEY,
    asset VARCHAR(10) NOT NULL,
    horizon VARCHAR(3) NOT NULL,
    current_price DECIMAL(20,8),
    implied_vol DECIMAL(10,6),
    up_probability DECIMAL(5,4),
    skew DECIMAL(10,6),
    regime VARCHAR(30),
    snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_asset ON forecast_snapshots(asset, snapshot_at DESC);

-- Auto-cleanup old snapshots (keep 7 days)
-- Run periodically via backend or cron
```

### Python Redis Pattern
```python
import redis.asyncio as redis
import json

redis_client = redis.from_url("redis://localhost:6379/0", decode_responses=True)

async def cache_synth(asset: str, horizon: str, data: dict):
    await redis_client.setex(f"synth:{asset}:{horizon}", 55, json.dumps(data))

async def get_cached_synth(asset: str, horizon: str) -> dict | None:
    raw = await redis_client.get(f"synth:{asset}:{horizon}")
    return json.loads(raw) if raw else None
```

### Python PostgreSQL Pattern (asyncpg via SQLAlchemy)
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine("postgresql+asyncpg://synthedge:pass@localhost:5432/synthedge")
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

For hackathon speed: use raw SQL via asyncpg directly if SQLAlchemy setup takes too long.

```python
import asyncpg

pool = await asyncpg.create_pool("postgresql://synthedge:pass@localhost:5432/synthedge")

async def save_snapshot(asset, horizon, price, vol, prob, skew, regime):
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO forecast_snapshots (asset, horizon, current_price, implied_vol, up_probability, skew, regime)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        """, asset, horizon, price, vol, prob, skew, regime)
```
