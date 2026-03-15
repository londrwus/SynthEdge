# SynthEdge — 1-Page Technical Explanation

## What It Does

SynthEdge is a probabilistic trading terminal that connects Synth's AI-powered price forecasts with Hyperliquid's on-chain equity perpetual execution. Users bring their own Synth API key and Hyperliquid wallet, then see probability distributions, volatility analytics, regime detection, and risk management — with direct trade execution on Hyperliquid's perps and HIP-3 equity markets.

**Live at:** https://synthedge.xyz

## How It Uses the Synth API

**Primary endpoint:** `/insights/prediction-percentiles` — polled every 5 minutes for 9 assets (BTC, ETH, SOL, XAU, SPY, NVDA, TSLA, AAPL, GOOGL) on the 24h horizon. Each response contains 289 timesteps with 9 percentile levels (0.5th through 99.5th). Cached in Redis with 10-minute TTL. From this single endpoint, we locally derive: implied volatility (P5–P95 spread annualized), directional probability (median vs current price), distribution skew and kurtosis, regime classification (4 types), tail risk metrics (P(2%/5%/10% drop)), and probability cone visualizations.

**Dedicated insight endpoints** called on-demand only: `/insights/option-pricing` for Monte Carlo call/put prices, `/insights/liquidation` for precise liquidation probabilities. This architecture uses ~144 API credits/hour — 85% less than naive polling.

## Probabilistic Modeling (30%)

Every feature is built on probability distributions, not point predictions:
- **VaR/CVaR** from distribution tails (forward-looking, not historical returns)
- **Kelly Criterion** position sizing using Synth-derived win/loss probabilities at user-specified TP/SL levels
- **Regime detection** from distribution shape: skew, kurtosis proxy, volatility width → 4 regimes with trading playbooks
- **Probability cones** render all 9 percentile levels across 289 timesteps with interactive D3.js crosshair
- **Earnings volatility** compares Synth's current forecast vol against historical earnings-day moves for equities
- **Smart order execution** derives SL/TP from distribution percentiles (P80 for TP, P20 for SL)
- **Cross-asset vol ratio** quantifies crypto vs equity volatility (~6x) from the same forecast model
- **Signals engine** generates actionable alerts: high-conviction direction (>62%), tail risk warnings, timeframe confluence, vol spikes, skew anomalies

## Technical Implementation (30%)

- **Backend:** Python 3.12 + FastAPI (async), 25 REST endpoints, background polling loop, Redis 7 caching with pipeline writes, GZip compression, connection pooling. 53 pytest tests passing.
- **Frontend:** Next.js 15 (App Router) + TypeScript, 12 routes, Tailwind CSS v4, TradingView Lightweight Charts v5, D3.js probability cone, Zustand state management, TanStack Query v5 with keepPreviousData for smooth updates.
- **Execution:** Hyperliquid Python SDK for crypto perps (BTC, ETH, SOL) and HIP-3 spot markets for equities (TSLA/USDC, AAPL/USDC, GOOGL/USDC, SPY/USDC). MetaMask wallet connect for portfolio viewing.
- **Infrastructure:** Docker Compose (5 containers), Nginx with Let's Encrypt SSL, Ubuntu 24.04. Deployed at synthedge.xyz.

## Practical Market Relevance (25%)

SynthEdge addresses all 5 hackathon equity examples: (1) Earnings volatility dashboard comparing forecasts against historical moves, (2) Cross-asset correlation tracking equities vs crypto vol, (3) Equity options strike selector from Synth's price ranges, (4) Portfolio risk monitor using Synth's vol forecasts, (5) Regime detection flagging vol environment shifts. Plus: directional scanner, Kelly position sizer, signals & alerts, and direct Hyperliquid trade execution.

## Innovation (15%)

SynthEdge is the first product bridging Synth's AI forecasts with Hyperliquid's on-chain execution. Key innovations: Synth-powered smart orders (SL/TP from percentiles, not arbitrary %), cross-asset vol ratio from the same AI model, regime-based trading playbooks from distribution shape analysis, and a signals engine that generates actionable alerts from probabilistic data. The BYOK model drives adoption of both Synth and Hyperliquid ecosystems.

## Architecture

```
User Browser → Nginx (SSL :443) → Docker Network
                    ├── Frontend (Next.js :3000) — 12 routes, TradingView, D3.js
                    └── Backend (FastAPI :8000) — 25 endpoints, Redis, PostgreSQL
                            ├── Synth API (prediction-percentiles, options, liquidation)
                            └── Hyperliquid API (perps trading, HIP-3 spot, portfolio)
```
