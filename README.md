# 🟢 SynthEdge

**Predictive Intelligence Meets On-Chain Execution**

> Synth's AI-powered probability distributions + Hyperliquid's equity perp execution — in one dark, neon-green terminal.

---

## What is SynthEdge?

A **real-time trading terminal** that bridges **Synth's probabilistic forecasts** with **Hyperliquid's on-chain equity perps**. Users bring their own Synth API key and Hyperliquid address — then see probability cones, volatility heatmaps, directional signals, and portfolio risk analytics.

**The loop:** See the edge → Size the position → Execute the trade → Monitor the risk.

### Asset Coverage (Synth × Hyperliquid)

| Asset | Synth | Hyperliquid Perp |
|-------|-------|------------------|
| SPY | SPYX | SPY perp (HIP-3) |
| NVDA | NVDAX | NVDA perp |
| TSLA | TSLAX | TSLA perp |
| AAPL | AAPLX | AAPL perp |
| GOOGL | GOOGLX | GOOGL perp |
| BTC | BTC | BTC perp |
| ETH | ETH | ETH perp |
| SOL | SOL | SOL perp |
| Gold | XAU | XAU perp |

---

## Features

### 🎯 Intelligence (Synth API)
- **Probability Cone Visualizer** — 5th/20th/50th/80th/95th percentile price bands across 1h + 24h
- **Directional Scanner** — Real-time up/down probability for all 9 assets
- **Volatility Heatmap** — Cross-asset vol matrix with 1h vs 24h term structure
- **Regime Detector** — Low-vol grind / high-vol trend / mean-reversion / tail-risk
- **Multi-Timeframe Confluence** — Where 1h and 24h forecasts agree

### 📊 Risk & Analytics
- **VaR / CVaR** — From Synth's distributions (not historical returns)
- **Kelly Position Sizer** — Input trade → get optimal size from Synth probabilities
- **Liquidation Guardian** — Probability of hitting liquidation from distribution tails
- **Tail Risk Monitor** — Tracks extreme percentiles, alerts on tail expansion
- **Funding Rate Arbitrage** — HL funding rates vs Synth directional forecasts

### ⚡ Execution (Hyperliquid)
- **Portfolio View** — Connect HL address, see positions enriched with Synth risk data
- **Trade Links** — Pre-filled deep links to Hyperliquid for one-click execution
- **Smart SL/TP** — Synth-derived stop-loss and take-profit levels

---

## Architecture

```
┌─────────────────────────┐
│  FRONTEND (Next.js 15)  │
│  Tailwind + shadcn/ui   │
│  TradingView Charts     │
│  D3.js (cones/heatmap)  │
│  TanStack Query polling │
└────────┬────────────────┘
         │ HTTP (polls every 10s)
┌────────┴────────────────┐
│  BACKEND (FastAPI)      │
│  Background poller:     │
│  Synth API → Redis      │  ← Polls Synth every 60s
│  HL Info API reads      │  ← On-demand position reads
│  NumPy analytics        │
└──┬─────────┬────────────┘
┌──┴───┐  ┌──┴────┐
│Redis │  │Postgres│
│cache │  │journal │
└──────┘  └───────┘
```

### API Efficiency
One endpoint (`/insights/prediction-percentiles`) polled per asset, cached in Redis. Everything else (vol, direction, skew, regime, liquidation risk) derived locally from the 9 percentile levels. Dedicated insight endpoints called only when user opens specific views.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui |
| Charts | TradingView Lightweight Charts, D3.js |
| State | Zustand (client), TanStack Query v5 (server) |
| Design | Pencil.dev (AI design → code) |
| Backend | Python 3.12, FastAPI, httpx, NumPy |
| Hyperliquid | hyperliquid-python-sdk (read-only) |
| Cache | Redis 7 |
| Database | PostgreSQL 16 |
| Infra | Docker Compose, Nginx, Ubuntu 24.04 |

---

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/synthedge.git
cd synthedge

cp .env.example .env
# Edit .env → add your SYNTH_API_KEY

# Start databases
docker compose up -d

# Backend
cd backend
pip install -e "."
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Hackathon Submission

**Category:** Best Equities Application ($5,000)

| Criteria | Weight | How We Score |
|----------|--------|-------------|
| Technical Implementation | 30% | Full Synth API + Hyperliquid SDK + FastAPI + Next.js |
| Probabilistic Modeling | 30% | VaR, Kelly, regime, cones, skew — all from distributions |
| Practical Market Relevance | 25% | Real portfolio data, actionable signals, trade execution |
| Innovation | 15% | First Synth × Hyperliquid terminal, BYOK model |

**Required:** GitHub repo ✓ | Demo video ✓ | 1-page technical explanation ✓ | Synth API ✓

---

## License

MIT

---

<p align="center">
  <strong>SynthEdge</strong> — See the edge. Size the position. Execute the trade.
</p>
