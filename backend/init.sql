-- SynthEdge — PostgreSQL Init
-- Runs automatically on first docker-compose up

CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hl_address VARCHAR(42) NOT NULL,
    asset VARCHAR(10) NOT NULL,
    direction VARCHAR(5) NOT NULL CHECK (direction IN ('long', 'short')),
    entry_price DECIMAL(20,8) NOT NULL,
    exit_price DECIMAL(20,8),
    size DECIMAL(20,8) NOT NULL,
    leverage DECIMAL(5,2) DEFAULT 1.0,
    pnl DECIMAL(20,8),
    pnl_pct DECIMAL(10,4),
    synth_up_prob DECIMAL(5,4),
    synth_vol DECIMAL(10,4),
    synth_regime VARCHAR(30),
    notes TEXT,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_address ON journal_entries(hl_address);
CREATE INDEX IF NOT EXISTS idx_journal_opened ON journal_entries(opened_at DESC);

CREATE TABLE IF NOT EXISTS forecast_snapshots (
    id BIGSERIAL PRIMARY KEY,
    asset VARCHAR(10) NOT NULL,
    horizon VARCHAR(3) NOT NULL,
    current_price DECIMAL(20,8),
    implied_vol DECIMAL(10,6),
    up_probability DECIMAL(5,4),
    skew DECIMAL(10,6),
    kurtosis_proxy DECIMAL(10,6),
    regime VARCHAR(30),
    snapshot_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snap_asset_time ON forecast_snapshots(asset, snapshot_at DESC);

-- Partition-friendly: delete snapshots older than 7 days periodically
-- DELETE FROM forecast_snapshots WHERE snapshot_at < NOW() - INTERVAL '7 days';
