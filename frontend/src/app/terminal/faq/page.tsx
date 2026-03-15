"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

// ─── HOW TO USE (non-technical users) ───────────────────────────────────
const HOW_TO_USE = [
  {
    category: "GETTING STARTED",
    items: [
      {
        q: "What is SynthEdge?",
        a: "SynthEdge is a trading intelligence terminal. It takes AI-powered price forecasts from Synth (which predicts where prices will go) and turns them into actionable signals: which assets are likely to go up/down, how much risk is involved, and how large your position should be. You can also trade directly on Hyperliquid from this terminal.",
      },
      {
        q: "How do I set up?",
        a: "Step 1: Get a free API key from dashboard.synthdata.co. Step 2: Paste it on the landing page or in Settings. Step 3: Click 'Launch Terminal'. That's it — data starts flowing immediately for all 9 assets. Optionally, connect your MetaMask wallet to view your Hyperliquid portfolio and trade.",
      },
      {
        q: "What assets are covered?",
        a: "9 assets across 3 classes: Equities (SPY, NVDA, TSLA, AAPL, GOOGL), Crypto (BTC, ETH, SOL), and Commodities (XAU/Gold). Synth provides probabilistic forecasts for all of them with 1-hour and 24-hour horizons.",
      },
      {
        q: "What does '24H' vs '1H' mean?",
        a: "These are forecast horizons. 24H shows where Synth thinks the price will be over the next 24 hours (289 data points, one every 5 minutes). 1H shows the next hour (61 data points, one every minute). 1H is for short-term scalping, 24H is for swing trading. Note: equities only support 24H on Synth's API.",
      },
    ],
  },
  {
    category: "USING THE DASHBOARD",
    items: [
      {
        q: "What does the Directional Scanner show?",
        a: "It shows all 9 assets ranked by how strongly Synth predicts their direction. 'BULL' means the AI forecast median is above the current price (expecting upward movement). The probability % shows how confident the forecast is — 60%+ is a strong signal. Click any asset to see its detailed analysis.",
      },
      {
        q: "How do I read the Probability Cone?",
        a: "The cone shows the range of possible prices over time. The narrower bands (30% CI) show where the price is most likely to end up. The wider bands (90% CI) show the extreme possibilities. The dashed line is the median forecast. The gold line is the current price. If the cone fans upward, Synth expects the price to rise. Hover over the cone to see exact prices at any point.",
      },
      {
        q: "What's the Volatility Heatmap?",
        a: "It shows implied volatility (forecast uncertainty) for every asset. Green = low vol (calm market), yellow/orange = high vol (volatile). Compare 1H vs 24H columns — if 1H vol is higher than 24H, that's unusual and may signal short-term stress.",
      },
      {
        q: "What does 'Regime' mean?",
        a: "The system classifies each asset into one of 4 market regimes: LOW VOL GRIND (tight ranges, good for selling options), HIGH VOL TREND (wide ranges with direction, good for trend-following), MEAN REVERSION (moderate vol, fade extremes), and TAIL RISK (fat tails detected, reduce leverage). The regime tells you which trading strategy to use.",
      },
    ],
  },
  {
    category: "SCREENER & RISK",
    items: [
      {
        q: "How does the Screener work?",
        a: "The Screener ranks assets by probabilistic metrics: highest upside probability, strongest conviction, highest volatility. It separates equities, crypto, and commodities so you can compare within each class. The crypto/equity vol ratio shows how much more volatile crypto is than stocks — useful for portfolio allocation.",
      },
      {
        q: "What does the Risk Monitor show?",
        a: "It shows the probability of various-sized drops for each asset. P(2% drop) = the chance the price drops 2% or more within the forecast horizon. If this is high (>15%), consider reducing your position size or leverage. The vol term structure shows whether short-term or long-term vol is higher — backwardation (short > long) is a stress signal.",
      },
      {
        q: "How do I use the Earnings Volatility dashboard?",
        a: "It compares Synth's current forecast volatility against how much stocks typically move on earnings days. If the vol ratio is >1.5x (ELEVATED), the market is pricing in more uncertainty than usual. If <0.5x (COMPRESSED), it's pricing in less. This helps you decide whether to buy or sell volatility before earnings.",
      },
    ],
  },
  {
    category: "TRADING & PORTFOLIO",
    items: [
      {
        q: "How do I connect my wallet?",
        a: "Click [CONNECT WALLET] in the header bar. This opens MetaMask (or your browser wallet). Your public address is used to read your Hyperliquid positions — we never access your private keys. Once connected, the Portfolio tab shows your positions enriched with Synth risk data.",
      },
      {
        q: "How does the Trade Panel work?",
        a: "On any Asset Detail page, you'll see a trade panel. Choose LONG (expecting price up) or SHORT (expecting price down), enter your size, and choose SMART ORDER (Synth sets your TP/SL from the probability distribution) or MARKET (simple market order). The trade executes directly on Hyperliquid.",
      },
      {
        q: "What is a Smart Order?",
        a: "Smart Orders use Synth's probability distribution to automatically set your Take Profit at the 80th percentile and Stop Loss at the 20th percentile. This means your TP has a ~20% probability of being hit and your SL has a ~20% probability of being hit — mathematically derived levels instead of guessing.",
      },
      {
        q: "What is the Kelly Calculator?",
        a: "The Kelly Criterion tells you what percentage of your portfolio to risk on a trade. Enter your entry price, take profit, and stop loss — it uses Synth's distribution to calculate win/loss probabilities and recommends the optimal position size. We use Half-Kelly (50% of the mathematical optimum) by default because it's safer in practice.",
      },
    ],
  },
];

// ─── TECHNICAL DEEP DIVE (quant/developer audience) ─────────────────────
const TECHNICAL = [
  {
    category: "SYNTH API & DATA PIPELINE",
    items: [
      {
        q: "How does SynthEdge consume Synth's API?",
        a: `The backend polls GET /insights/prediction-percentiles every 5 minutes for each of the 9 supported assets on the 24h horizon. Each response contains 289 timesteps (5-minute intervals over 24 hours) with 9 percentile levels: 0.5th, 5th, 20th, 35th, 50th (median), 65th, 80th, 95th, and 99.5th. This is cached in Redis with a 10-minute TTL. All derived metrics (vol, direction, skew, kurtosis, regime, tail risk) are computed locally from these percentiles — no additional API calls needed. Dedicated insight endpoints (/insights/option-pricing, /insights/liquidation) are called on-demand only when the user opens those specific views, never in a polling loop. This architecture uses ~144 API credits/hour.`,
      },
      {
        q: "Why derive locally instead of using Synth's dedicated endpoints?",
        a: `Credit efficiency. Each API call costs 1 credit. If we called /volatility, /option-pricing, /liquidation separately for each asset, we'd use 4x more credits. The percentiles endpoint gives us enough distributional shape to derive reasonable approximations of implied vol, directional probability, skew, kurtosis, and liquidation risk. We only use dedicated endpoints where precision matters (Monte Carlo option pricing uses 1,000 simulated paths, which the 9-percentile summary can't replicate). This strategy is explicitly recommended in Synth's API documentation.`,
      },
      {
        q: "How is the data cached?",
        a: `Redis 7 with a 10-minute TTL and pipeline writes. Each poll cycle writes both the raw percentiles (synth:{asset}:{horizon}) and the derived metrics (derived:{asset}:{horizon}) atomically. The frontend polls the backend every 15 seconds, which serves from Redis cache — never triggering Synth API calls. TanStack Query on the frontend adds another layer: staleTime=10s prevents redundant requests, and keepPreviousData prevents UI flicker during refetches.`,
      },
    ],
  },
  {
    category: "PROBABILISTIC MODELING",
    items: [
      {
        q: "How is Implied Volatility calculated?",
        a: `From the last timestep of the forecast distribution: IV = ((P95 - P05) / current_price) / (2 × 1.645) × √(8760 / horizon_hours). The P95-P05 spread represents the 90% confidence interval. Dividing by 2×1.645 converts to standard deviation (since 90% CI ≈ ±1.645σ for a normal distribution). The √(8760/hours) factor annualizes: 8760 = hours per year. This gives an annualized volatility comparable to market-quoted IV, though it's derived from Synth's AI forecast rather than options markets.`,
      },
      {
        q: "How does Regime Detection work?",
        a: `Four regimes classified from distribution shape at the last timestep: (1) TAIL RISK: kurtosis proxy > 4.0 AND wide range > 5% — fat tails detected. (2) HIGH VOL TREND: wide range > 3% AND |median move| > 0.5% — directional with high uncertainty. (3) LOW VOL GRIND: wide range < 1.5% — tight distribution, calm market. (4) MEAN REVERSION: everything else — moderate, balanced distribution. Kurtosis proxy = (P99.5 - P0.5) / (P80 - P20), measuring tail fatness relative to the body. Skew = (upside - downside) / (upside + downside) where upside = P95 - P50, downside = P50 - P05.`,
      },
      {
        q: "How does the Kelly Criterion use Synth data?",
        a: `Given a user's entry, TP, and SL prices, we interpolate where those levels fall in Synth's percentile distribution. For a long trade: win_prob ≈ 1 - percentile(TP), loss_prob ≈ percentile(SL). These are normalized so they sum to 1. Then Kelly fraction f* = (p×b - q) / b, where p = win probability, q = 1-p, b = avg_win/avg_loss ratio. We apply 0.5× (Half-Kelly) by default for variance reduction. The result is the mathematically optimal fraction of capital to risk, derived from the forecast distribution rather than historical data.`,
      },
      {
        q: "How is Liquidation Risk estimated?",
        a: `For a leveraged position, the liquidation price ≈ entry × (1 - 1/leverage) for longs. We find where this price falls in Synth's percentile distribution by linear interpolation between the 9 percentile levels. If the liquidation price is between the 5th and 20th percentile, the probability is interpolated between 0.05 and 0.20. For dedicated precision, the /insights/liquidation endpoint uses the full 1,000 Monte Carlo paths for exact probability computation across 6/12/18/24h windows.`,
      },
      {
        q: "How does the Earnings Volatility comparison work?",
        a: `We compute Synth's current expected 24h move from the P05-P95 range width as a percentage of current price. This is compared against the historical average absolute 1-day earnings move for each equity (last 6 quarters of public data). The vol ratio = Synth annualized vol / historical earnings annualized vol. A ratio > 1.5x means current forecast vol exceeds typical earnings vol (ELEVATED signal — unusual uncertainty). Below 0.5x means the forecast is calmer than typical earnings (COMPRESSED — potential vol expansion ahead).`,
      },
    ],
  },
  {
    category: "CROSS-ASSET ANALYTICS",
    items: [
      {
        q: "How is the crypto/equity vol ratio calculated?",
        a: `Average annualized implied vol across BTC, ETH, SOL divided by average annualized implied vol across SPY, NVDA, TSLA, AAPL, GOOGL. Both use the same Synth percentile-derived formula, making them directly comparable. Currently the ratio is ~6x, meaning crypto is approximately 6 times more volatile than equities according to Synth's forecast distributions. This is consistent with market observations and useful for cross-asset portfolio construction.`,
      },
      {
        q: "What is Vol Term Structure and why does it matter?",
        a: `We compare 1h implied vol (annualized) against 24h implied vol (annualized) for each asset. Normal markets show 'contango': 24h vol > 1h vol (uncertainty increases with time). 'Backwardation' (1h > 24h) signals short-term stress — something is happening NOW that makes the next hour more uncertain than the next day. This is a well-known quantitative signal used by institutional vol traders. Note: equities only support 24h on Synth, so term structure is only available for BTC, ETH, SOL, XAU.`,
      },
    ],
  },
  {
    category: "ARCHITECTURE & PERFORMANCE",
    items: [
      {
        q: "What's the tech stack?",
        a: `Backend: Python 3.12, FastAPI (async), Redis 7 (cache), PostgreSQL 16 (persistence), NumPy/SciPy (math). 25 REST API endpoints. Frontend: Next.js 15 (App Router), TypeScript, TailwindCSS v4, TradingView Lightweight Charts v5, D3.js (probability cone), Zustand (state), TanStack Query v5 (data fetching). Infrastructure: Docker Compose, Nginx, Ubuntu 24.04. All hosted at synthedge.xyz.`,
      },
      {
        q: "How is API credit usage optimized?",
        a: `Three layers: (1) Backend polls Synth every 5 minutes (not 10 seconds), 24h only per default cycle, 1h every 3rd cycle — ~144 credits/hour vs 1,080 naively. (2) Redis cache with 10-minute TTL means the frontend reads from cache, never triggering API calls. (3) Dedicated insight endpoints (options, liquidation) are called on-demand only, never polled. GZip middleware reduces response sizes by ~85%. Connection pooling reuses HTTP clients across requests. Total: fits within Synth's 20,000 monthly credit budget.`,
      },
      {
        q: "How does Hyperliquid integration work?",
        a: `Read path: The backend uses hyperliquid-python-sdk's Info class to read user positions, margin, funding rates — no private keys needed, just the public address. Trade path: The frontend connects MetaMask via window.ethereum to get the user's address. Trade orders are sent to the backend which uses the Exchange class with the user's signing. Smart Orders derive SL/TP from Synth's percentile distribution (P80 for TP, P20 for SL) before execution. All signing is per-request — keys are never stored.`,
      },
      {
        q: "How are the 53 backend tests structured?",
        a: `Two test files: test_derivations.py (38 tests) covers all mathematical functions — implied vol bounds, directional probability classification, skew/kurtosis ranges, regime detection for all 4 types, Kelly non-negativity and probability normalization, liquidation probability monotonicity. test_api.py (15 tests) covers endpoint responses with mocked Redis using a FakeRedis in-memory implementation. Tests run in 0.77 seconds with pytest-asyncio.`,
      },
    ],
  },
];

export default function FAQPage() {
  const [activeTab, setActiveTab] = useState<"use" | "technical">("use");
  const [openIdx, setOpenIdx] = useState<string | null>(null);

  const sections = activeTab === "use" ? HOW_TO_USE : TECHNICAL;

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-mono text-xl font-bold text-text-primary tracking-wider">
          {"// HELP & DOCUMENTATION"}
        </h1>
        <span className="font-mono text-[9px] text-neon-green tracking-wider">[GUIDE]</span>
      </div>

      {/* Tab Switcher */}
      <div className="flex border border-border-dim">
        <button
          onClick={() => { setActiveTab("use"); setOpenIdx(null); }}
          className={cn(
            "flex-1 py-3 font-mono text-[11px] tracking-widest transition-all text-center",
            activeTab === "use"
              ? "bg-neon-green/10 text-neon-green border-b-2 border-b-neon-green"
              : "text-text-muted bg-bg-secondary hover:text-text-secondary"
          )}
        >
          HOW TO USE
        </button>
        <button
          onClick={() => { setActiveTab("technical"); setOpenIdx(null); }}
          className={cn(
            "flex-1 py-3 font-mono text-[11px] tracking-widest transition-all text-center border-l border-border-dim",
            activeTab === "technical"
              ? "bg-neon-green/10 text-neon-green border-b-2 border-b-neon-green"
              : "text-text-muted bg-bg-secondary hover:text-text-secondary"
          )}
        >
          TECHNICAL DEEP DIVE
        </button>
      </div>

      {/* Tab Description */}
      <div className="bg-bg-secondary border border-border-dim p-4">
        <p className="font-mono text-[10px] text-text-secondary tracking-wider leading-relaxed">
          {activeTab === "use"
            ? "STEP-BY-STEP GUIDE FOR USING SYNTHEDGE. COVERS SETUP, NAVIGATION, READING SIGNALS, AND EXECUTING TRADES. DESIGNED FOR ALL EXPERIENCE LEVELS."
            : "QUANTITATIVE METHODOLOGY AND ARCHITECTURE DETAILS. COVERS PROBABILISTIC MODELING FORMULAS, DATA PIPELINE ARCHITECTURE, API OPTIMIZATION STRATEGIES, AND TESTING INFRASTRUCTURE. FOR DEVELOPERS AND QUANT TRADERS."
          }
        </p>
      </div>

      {/* Sections */}
      {sections.map((section) => (
        <div key={section.category} className="bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim">
            <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// "}{section.category}
            </h2>
          </div>
          <div>
            {section.items.map((item, idx) => {
              const key = `${activeTab}-${section.category}-${idx}`;
              const isOpen = openIdx === key;
              return (
                <div key={key} className="border-b border-border-dim/50 last:border-b-0">
                  <button
                    onClick={() => setOpenIdx(isOpen ? null : key)}
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-bg-hover transition-colors"
                  >
                    <span className="font-mono text-[11px] text-text-primary tracking-wider pr-4">
                      {item.q}
                    </span>
                    <span className={cn(
                      "font-mono text-[10px] shrink-0 transition-transform",
                      isOpen ? "text-neon-green" : "text-text-muted"
                    )}>
                      {isOpen ? "[-]" : "[+]"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      <div className="p-3 border-l-2 border-neon-green/30 bg-bg-tertiary">
                        <p className="font-mono text-[10px] text-text-secondary leading-[1.8] tracking-wider whitespace-pre-line">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Footer */}
      <div className="bg-bg-secondary border border-border-dim p-4 space-y-2">
        <p className="font-mono text-[9px] text-text-muted tracking-wider">
          // DISCLAIMER
        </p>
        <p className="font-mono text-[9px] text-text-muted tracking-wider leading-relaxed">
          SYNTHEDGE PROVIDES PROBABILISTIC ANALYTICS DERIVED FROM SYNTH API DATA.
          THIS IS NOT FINANCIAL ADVICE. ALL TRADING INVOLVES SUBSTANTIAL RISK OF
          LOSS. PAST PERFORMANCE AND FORECASTS DO NOT GUARANTEE FUTURE RESULTS.
          HYPERLIQUID IS NOT AVAILABLE IN USA, UK, OR SANCTIONED COUNTRIES.
        </p>
        <div className="flex gap-4 pt-2 border-t border-border-dim">
          <a href="https://docs.synthdata.co" target="_blank" rel="noopener noreferrer"
            className="font-mono text-[9px] text-neon-green/70 hover:text-neon-green tracking-wider">
            SYNTH API DOCS ↗
          </a>
          <a href="https://hyperliquid.gitbook.io" target="_blank" rel="noopener noreferrer"
            className="font-mono text-[9px] text-neon-green/70 hover:text-neon-green tracking-wider">
            HYPERLIQUID DOCS ↗
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="font-mono text-[9px] text-neon-green/70 hover:text-neon-green tracking-wider">
            GITHUB REPO ↗
          </a>
        </div>
      </div>
    </div>
  );
}
