# SKILL: Open Source References & Libraries

## Overview
Curated list of open-source projects, libraries, and references useful for building SynthEdge. All are free/MIT/Apache licensed unless noted.

---

## Hyperliquid Ecosystem (Open Source)

### Official SDK
- **hyperliquid-python-sdk** — Official Python SDK for trading
  - Repo: https://github.com/hyperliquid-dex/hyperliquid-python-sdk
  - License: MIT
  - Install: `pip install hyperliquid-python-sdk`
  - Provides: Exchange (orders), Info (read-only), WebSocket subscriptions

### Community TypeScript SDKs (for frontend)
- **nktkas/hyperliquid** — https://github.com/nktkas/hyperliquid
- **nomeida/hyperliquid** — https://github.com/nomeida/hyperliquid
- **CCXT** — https://docs.ccxt.com/#/exchanges/hyperliquid (multi-language, standardized API)

### Reference Projects
- **hyperscalper** — Professional HL trading terminal (Next.js + TradingView)
  - Repo: https://github.com/jestersimpps/hyperscalper
  - Useful for: Terminal layout patterns, TradingView integration, Zustand stores
  - License: Personal use

- **hyperliquid-stats** — FastAPI + PostgreSQL analytics dashboard
  - Repo: https://github.com/thunderhead-labs/hyperliquid-stats
  - Useful for: FastAPI + Postgres patterns, API endpoint design

- **hyperliquid_rust_bot** — Rust + React trading terminal
  - Repo: https://github.com/0xNoSystem/hyperliquid_rust_bot
  - Useful for: Rust backend patterns, Actix WebSocket, React dashboard

- **Hyperliquid-Trading-Dashboard** — Next.js + Privy wallet integration
  - Repo: https://github.com/Aayushgoyal00/Hyperliquid-Trading-Dashboard
  - Useful for: Wallet connection flow, Next.js App Router structure

- **Hyperliquid-Data-Layer-API** — Python data layer with terminal dashboards
  - Repo: https://github.com/moondevonyt/Hyperliquid-Data-Layer-API
  - Useful for: Liquidation heatmaps, order flow, whale tracking patterns

---

## Charting Libraries

### TradingView Lightweight Charts
- Repo: https://github.com/tradingview/lightweight-charts
- License: Apache 2.0 (requires attribution link to tradingview.com)
- Size: ~45KB
- Docs: https://tradingview.github.io/lightweight-charts/
- React tutorial: https://tradingview.github.io/lightweight-charts/tutorials/react/simple
- Use for: Candlestick charts, line charts, area charts, price overlays
- **MUST add attribution:** Link to https://www.tradingview.com/ on the page

### D3.js
- Repo: https://github.com/d3/d3
- License: ISC (permissive)
- Use for: Probability cones (custom SVG), heatmaps, distribution histograms, gauges
- Install: `npm install d3 @types/d3`

### Recharts (alternative for simple charts)
- Repo: https://github.com/recharts/recharts
- License: MIT
- Use for: Simple bar/line charts if D3 is overkill for a specific view

---

## Frontend Libraries

### UI Framework
- **shadcn/ui** — https://ui.shadcn.com/
  - Not a package — copy components into your project
  - Based on Radix UI primitives + Tailwind
  - `npx shadcn@latest init` then `npx shadcn@latest add button card dialog ...`
  - Fully customizable, perfect for dark terminal theme

### State Management
- **Zustand** — https://github.com/pmndrs/zustand (MIT)
  - Lightweight, no boilerplate, works great with React 18+
  - `npm install zustand`

### Server State
- **TanStack Query v5** — https://tanstack.com/query (MIT)
  - Handles caching, refetching, stale-while-revalidate
  - `npm install @tanstack/react-query`
  - Use `refetchInterval` for polling endpoints

### Animation
- **Framer Motion** — https://github.com/framer/motion (MIT)
  - `npm install framer-motion`
  - Use for: Number transitions, panel slides, glow pulse

### Fonts
- **JetBrains Mono** — https://www.jetbrains.com/lp/mono/ (OFL)
  - via `next/font/google`
- **Inter** — https://rsms.me/inter/ (OFL)
  - via `next/font/google`

### Wallet / Crypto Utils
- **viem** — https://github.com/wevm/viem (MIT)
  - Ethereum interactions, message signing for HL API
  - `npm install viem`
- **ethers.js v6** — Alternative to viem
  - `npm install ethers`

---

## Backend Libraries

### Web Framework
- **FastAPI** — https://github.com/tiangolo/fastapi (MIT)
  - `pip install "fastapi[standard]"`

### Async HTTP
- **httpx** — https://github.com/encode/httpx (BSD-3)
  - For Synth API calls: `pip install httpx`

### Database Drivers
- **asyncpg** — Fastest PostgreSQL driver for Python
  - `pip install asyncpg`
- **Motor** — Async MongoDB driver
  - `pip install motor`
- **redis.asyncio** — Built into redis-py
  - `pip install redis`

### ORM
- **SQLAlchemy 2.0** — Async ORM
  - `pip install "sqlalchemy[asyncio]"`
- **Alembic** — Migrations
  - `pip install alembic`

### Task Queue
- **Celery** — Distributed task queue
  - `pip install celery[redis]`

### Numerical
- **NumPy** — Array operations
- **SciPy** — Statistical functions (interpolation, distributions)

### Rust Bridge
- **PyO3** — Rust ↔ Python FFI
  - https://github.com/PyO3/pyo3
- **maturin** — Build tool for PyO3 modules
  - `pip install maturin`
  - `maturin develop` in the rust_core directory

---

## Design Tools

### Pencil.dev
- Website: https://www.pencil.dev/
- Docs: https://docs.pencil.dev/
- License: Free (during early access, uses your own AI API)
- Install: VS Code extension or standalone desktop app
- MCP server auto-configured on install
- Workflow: Design in .pen files → export as React/Tailwind code
- Store .pen files in `frontend/designs/` for version control

---

## Synth Ecosystem

### Synth Subnet (for context, not direct dependency)
- Repo: https://github.com/mode-network/synth-subnet
- Whitepaper: https://mode-network.github.io/synth-subnet/Synth%20Whitepaper%20v1.pdf
- Dashboard: https://dashboard.synthdata.co
- Miner dashboard: https://miners.synthdata.co

### Synth API
- Docs: https://docs.synthdata.co
- Swagger: https://api.synthdata.co/docs/swagger.json
- Base URL: https://api.synthdata.co
- MCP server available for Claude Code integration

---

## Useful Patterns from Existing Projects

### From hyperscalper (terminal layout)
- Sidebar with collapsible asset list
- Multi-panel layout with resizable panes
- TradingView chart integration in Next.js
- Zustand store for settings persistence

### From hyperliquid-stats (data pipeline)
- FastAPI + PostgreSQL for analytics
- Docker Compose setup with pgdata volume
- Endpoint design for time-series queries

### From hyperliquid_rust_bot (Rust + React)
- Actix WebSocket for real-time data
- Rust indicator calculations
- React dashboard consuming WS feed

### From NOFX (AI trading agent)
- Architecture: Go backend + React frontend + TradingView
- Multi-exchange abstraction
- Strategy engine patterns
