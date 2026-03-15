# SynthEdge — Technical Explanation

## What It Does

SynthEdge is a **probabilistic trading terminal** that connects **Synth's AI-powered price forecasts** with **Hyperliquid's on-chain equity perpetual execution**. Users bring their own Synth API key and Hyperliquid wallet, then see probability distributions, volatility analytics, regime detection, and risk management — with direct trade execution on Hyperliquid's equity perps.

## How It Uses the Synth API

**Primary endpoint:** `/insights/prediction-percentiles` — polled every 5 minutes for 9 assets, cached in Redis with 10-minute TTL. From this single endpoint, we **locally derive everything**: implied volatility (5th–95th percentile spread), directional probability (median vs current price), distribution skew and kurtosis, liquidation risk estimates, regime classification, tail risk metrics, and probability cone visualizations.

**Dedicated insight endpoints** (called on-demand, not polled):
- `/insights/option-pricing` — Monte Carlo-derived theoretical call/put prices for the options view
- `/insights/liquidation` — Precise liquidation probabilities from 1000 simulated paths
- `/insights/lp-bounds` — Price interval probability analysis

**Credit efficiency:** ~144 credits/hour (9 assets × 12 polls/hr for 24h, plus 4 polls/hr for 1h). All derived metrics computed locally from percentiles — no redundant API calls.

**Assets covered:** BTC, ETH, SOL, XAU, SPY, NVDA, TSLA, AAPL, GOOGL — across both 1h and 24h horizons.

## Probabilistic Modeling (30% of criteria)

Every feature is built on Synth's probability distributions, not point predictions:

- **VaR/CVaR** from Synth's distribution tails (forward-looking, not historical returns)
- **Kelly Criterion** position sizing using Synth-derived win/loss probabilities at user-specified TP/SL levels
- **Regime detection** from distribution shape: skew, kurtosis proxy, volatility width → classifies into 4 regimes
- **Probability cones** render the full 9-percentile forecast across all 289 timesteps with interactive crosshair
- **Tail risk monitoring** tracks P(2%/5%/10% drop) from extreme percentiles
- **Cross-asset correlation** compares crypto vol vs equity vol using Synth's distributions (currently 6x ratio)
- **Distribution analysis** shows percentile returns, confidence interval widths, skew interpretation
- **Smart order execution** derives SL/TP from Synth's distribution percentiles (80th/20th)
- **Vol term structure** compares 1h vs 24h vol for contango/backwardation detection

## Technical Implementation (30% of criteria)

- **Backend:** Python 3.12 + FastAPI (async), 24 REST endpoints, background polling loop, Redis caching with pipeline writes
- **Frontend:** Next.js 15 (App Router) + TypeScript, 10 routes, Tailwind CSS v4, TradingView Lightweight Charts v5, D3.js
- **State:** Zustand (client), TanStack Query v5 (server) with `keepPreviousData` for smooth updates
- **Execution:** Hyperliquid Python SDK for trading (market orders, smart orders with Synth-derived levels)
- **Charts:** TradingView Lightweight Charts for interactive forecast visualization, D3.js for probability cone with crosshair tooltip
- **Caching:** Redis 7 with 10-minute TTL, connection pooling, pipeline writes, configurable polling intervals
- **Design:** Pencil.dev with industrial terminal aesthetic (JetBrains Mono, zero radius, neon green on near-black)

## Practical Market Relevance (25% of criteria)

SynthEdge solves real problems for active traders:

1. **Equity Screener** — Ranks SPY, NVDA, TSLA, AAPL, GOOGL by upside probability, conviction, and vol
2. **Risk Monitor** — Forward-looking VaR dashboard with tail risk alerts and regime-based recommendations
3. **Smart Execution** — Trade directly on Hyperliquid with Synth-derived SL/TP levels
4. **Portfolio View** — Connect Hyperliquid wallet to see positions enriched with Synth risk data
5. **Kelly Sizer** — Mathematically optimal position sizing from probability distributions

## Innovation (15% of criteria)

SynthEdge is the **first product bridging Synth's AI forecasts with Hyperliquid's on-chain execution**. The BYOK model drives adoption of both ecosystems. Key innovations:
- **Synth-powered smart orders** — SL/TP derived from probability percentiles, not arbitrary percentages
- **Cross-asset vol ratio** — quantifies crypto vs equity volatility from the same forecasting model
- **Regime-based trading** — distribution shape analysis generates actionable playbooks per regime
- **Vol term structure** — 1h vs 24h comparison detects stress conditions

## Architecture

```
User Browser                Backend (FastAPI)              External
┌──────────────┐    ┌──────────────────────┐     ┌──────────────┐
│ Next.js 15   │───▶│ 24 REST Endpoints    │───▶│ Synth API    │
│ TradingView  │◀───│ Redis Cache (10min)  │◀───│ (percentiles)│
│ D3.js Cones  │    │ Background Poller    │    ├──────────────┤
│ Zustand      │    │ NumPy Analytics      │    │ Hyperliquid  │
│ TanStack     │    │ HL Trading SDK       │    │ (trade + info)│
└──────────────┘    │ PostgreSQL           │    └──────────────┘
                    └──────────────────────┘
```
