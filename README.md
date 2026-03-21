# SynthEdge

**Predictive Intelligence Meets On-Chain Execution**

> Synth's AI-powered probability distributions + Hyperliquid's equity perp execution — in one terminal.

**Live:** [https://synthedge.xyz](https://synthedge.xyz)
**Category:** Best Equities Application
**Hackathon:** Synth Predictive Intelligence Hackathon 2026

---

## What is SynthEdge?

A **probabilistic trading terminal** that bridges **Synth's AI forecasts** with **Hyperliquid's on-chain execution**. Users bring their own Synth API key and optionally connect a Hyperliquid wallet — then see probability cones, volatility analytics, regime detection, risk management, and execute trades directly.

**The loop:** See the edge → Size the position → Execute the trade → Monitor the risk.

---

## Features

### Intelligence (Synth API)
- **Probability Cone** — Interactive D3.js visualization of 9-percentile price distribution with zoom/pan and crosshair tooltip
- **Directional Scanner** — All 9 assets ranked by up/down probability, vol, regime, skew, conviction
- **Volatility Heatmap** — Cross-asset vol comparison (1h vs 24h) with color-coded cells
- **Equity Screener** — Ranks SPY, NVDA, TSLA, AAPL, GOOGL by probabilistic metrics
- **Signals & Alerts** — Actionable signals: high-conviction direction, confluence, tail risk, vol spikes, skew
- **Earnings Volatility** — Synth's current forecast vol vs historical earnings-day moves for equities
- **Regime Detection** — Classifies each asset into 4 regimes (low vol grind, high vol trend, mean reversion, tail risk)

### Risk & Analytics
- **VaR / CVaR** — Forward-looking from Synth's distribution tails
- **Kelly Position Sizer** — Optimal sizing from Synth-derived win/loss probabilities
- **Risk Monitor** — Tail risk dashboard with vol term structure and regime-based recommendations
- **Distribution Analysis** — Percentile returns, CI widths, skew interpretation
- **Cross-Asset Vol** — Crypto vs equity vol ratio (~6x) from the same forecast model
- **Options Pricing** — Monte Carlo-derived theoretical call/put prices from Synth

### Execution (Hyperliquid)
- **Wallet Connect** — MetaMask/web3 wallet integration for portfolio viewing
- **Trade Panel** — Direct LONG/SHORT execution on Hyperliquid with configurable leverage (1-20x)
- **Smart Orders** — SL/TP automatically derived from Synth's distribution percentiles (P80/P20)
- **Portfolio View** — Positions enriched with Synth risk data, close button, margin summary

---

## Asset Coverage

| Asset | Synth API | Hyperliquid | Type |
|-------|-----------|-------------|------|
| SPY | SPY | SPY/USDC (HIP-3) | Equity |
| NVDA | NVDA | — | Equity |
| TSLA | TSLA | TSLA/USDC (HIP-3) | Equity |
| AAPL | AAPL | AAPL/USDC (HIP-3) | Equity |
| GOOGL | GOOGL | GOOGL/USDC (HIP-3) | Equity |
| BTC | BTC | BTC perp | Crypto |
| ETH | ETH | ETH perp | Crypto |
| SOL | SOL | SOL perp | Crypto |
| XAU | XAU | — | Commodity |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4 |
| Charts | TradingView Lightweight Charts v5, D3.js |
| State | Zustand (client), TanStack Query v5 (server) |
| Backend | Python 3.12, FastAPI, 25 REST endpoints |
| Execution | Hyperliquid Python SDK (perps + HIP-3 spot) |
| Cache | Redis 7 (10-min TTL, pipeline writes) |
| Database | PostgreSQL 16 |
| Infra | Docker Compose, Nginx, Let's Encrypt SSL |

---

## Architecture

```
Internet → Nginx (SSL) → Docker Network
                │
    ┌───────────┴───────────┐
    │                       │
Frontend :3000         Backend :8000
(Next.js standalone)   (FastAPI + uvicorn)
                            │
                    ┌───────┴───────┐
                    │               │
               Redis :6379    Postgres :5432
               (cache)       (journal data)
                    │
            ┌───────┴───────┐
            │               │
        Synth API     Hyperliquid API
      (percentiles)   (trading + info)
```

---

## Quick Start (Local Development)

```bash
# Clone
git clone https://github.com/londrwus/SynthEdge.git
cd SynthEdge

# Start databases
docker compose up -d

# Backend
cd backend
python -m venv .venv
source .venv/Scripts/activate  # Windows
pip install -e "."
cp ../.env.example ../.env     # Add your SYNTH_API_KEY
uvicorn app.main:app --reload --port 8000

# Frontend
cd ../frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## API Endpoints (25 total)

### Synth Data
- `GET /api/synth/percentiles` — Cached prediction percentiles
- `GET /api/synth/percentiles/all` — All 9 assets

### Analytics (derived locally)
- `GET /api/analytics/scanner` — Directional scanner
- `GET /api/analytics/derived/all` — All derived metrics
- `POST /api/analytics/kelly` — Kelly position sizer
- `GET /api/analytics/liquidation-risk` — Liquidation probability

### Deep Insights (on-demand Synth API calls)
- `GET /api/insights/options` — Monte Carlo option pricing
- `GET /api/insights/distribution` — Distribution shape analysis
- `GET /api/insights/cross-asset-vol` — Cross-asset volatility
- `GET /api/insights/vol-term-structure` — Vol term structure

### Earnings
- `GET /api/earnings/dashboard` — Forecast vs historical earnings vol

### Trading (Hyperliquid)
- `POST /api/trading/market-order` — Market order execution
- `POST /api/trading/smart-order` — Synth-powered SL/TP order
- `POST /api/trading/close` — Close position

### Portfolio
- `GET /api/portfolio/positions` — HL positions + Synth enrichment

---

## Tests

```bash
cd backend
python -m pytest tests/ -v
# 53 tests, all passing (0.79s)
```

---

## Selection Criteria Alignment

| Criteria | Weight | How We Score |
|----------|--------|-------------|
| Technical Implementation | 30% | Full-stack: FastAPI + Next.js + Redis + Docker + HL SDK. 25 endpoints, 53 tests. |
| Probabilistic Modeling | 30% | VaR, Kelly, regime detection, probability cones, distribution analysis, skew — all from Synth distributions. |
| Practical Market Relevance | 25% | Real portfolio data, actionable signals, trade execution, risk monitoring. |
| Innovation | 15% | First Synth × Hyperliquid terminal. Smart orders with distribution-derived SL/TP. |

---

## License

MIT

---

<p align="center">
  <strong>SynthEdge</strong> — See the edge. Size the position. Execute the trade.
</p>
