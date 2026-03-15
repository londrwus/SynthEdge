"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const FAQ_SECTIONS = [
  {
    category: "GETTING STARTED",
    items: [
      {
        q: "What is SynthEdge?",
        a: "SynthEdge is a probabilistic trading terminal that connects Synth's AI-powered price forecasts with Hyperliquid's on-chain equity perpetual execution. It shows probability distributions, not point predictions — giving you confidence intervals and risk metrics for 9 assets across crypto, equities, and commodities.",
      },
      {
        q: "What is a Synth API key and how do I get one?",
        a: "Synth provides AI-powered probabilistic price forecasts. You need an API key to access their data. Get one at dashboard.synthdata.co. The key is stored locally in your browser and never sent to our servers.",
      },
      {
        q: "Do I need a Hyperliquid address?",
        a: "No, it's optional. If you connect one, you can view your portfolio positions enriched with Synth risk data. SynthEdge only reads your positions (read-only) — no private keys are ever used.",
      },
    ],
  },
  {
    category: "PROBABILITY CONE",
    items: [
      {
        q: "What does the probability cone show?",
        a: "The cone visualizes Synth's price distribution forecast over time. The bands represent confidence intervals: 90% CI (5th-95th percentile), 60% CI (20th-80th), and 30% CI (35th-65th). The wider the cone, the more uncertain the forecast. The dashed green line is the median (50th percentile) forecast. The gold line is the current price.",
      },
      {
        q: "How do I read it?",
        a: "If the median line (green dashed) is above the current price (gold dashed), the model predicts upward movement. The width of the bands tells you the expected volatility range. Hover over the cone to see exact prices at each percentile for any timestep.",
      },
    ],
  },
  {
    category: "DIRECTIONAL SCANNER",
    items: [
      {
        q: "What is the directional scanner?",
        a: "It shows all 9 tracked assets with their current direction (bullish/bearish based on median forecast vs current price), up probability (where current price sits in the distribution), implied volatility, and market regime classification.",
      },
      {
        q: "What do the regimes mean?",
        a: "LOW VOL GRIND: Tight ranges, favor mean-reversion. HIGH VOL TREND: Wide ranges with directional bias, favor trend-following. MEAN REVERSION: Moderate vol, balanced distribution. TAIL RISK: Fat tails detected, reduce leverage.",
      },
    ],
  },
  {
    category: "KELLY CALCULATOR",
    items: [
      {
        q: "What is the Kelly Criterion?",
        a: "The Kelly Criterion is a formula that determines the optimal fraction of your portfolio to risk on a trade, based on win probability and win/loss ratio. We use Half-Kelly (50% of optimal) by default, which is the industry standard for reduced variance.",
      },
      {
        q: "How does it use Synth data?",
        a: "We estimate win/loss probabilities by finding where your take-profit and stop-loss levels fall within Synth's probability distribution. If your TP is above the 80th percentile, there's roughly a 20% chance of hitting it. This gives a probabilistic edge calculation rather than guessing.",
      },
    ],
  },
  {
    category: "OPTIONS PRICING",
    items: [
      {
        q: "Where do the option prices come from?",
        a: "Synth runs 1,000 Monte Carlo simulations of future price paths and derives theoretical call/put prices at various strikes. These are NOT market prices — they're Synth's best estimate of fair value based on their probabilistic model.",
      },
      {
        q: "How can I use this?",
        a: "Compare Synth's theoretical prices against market-quoted options. If Synth says a call is worth $5 but the market is pricing it at $7, you might have a selling opportunity (overpriced). If the market is at $3, it might be underpriced. This is the edge-finding use case.",
      },
    ],
  },
  {
    category: "VOLATILITY & RISK",
    items: [
      {
        q: "What is implied volatility in this context?",
        a: "Unlike traditional IV (derived from options markets), our implied vol is derived from Synth's forecast distribution. We measure the 5th-to-95th percentile spread, normalize by price, and annualize. It represents the model's forecast uncertainty — not market sentiment.",
      },
      {
        q: "What do the tail risk percentages mean?",
        a: "P(2% drop) = probability that the price drops more than 2% within the forecast horizon. These are derived from Synth's percentile levels. High tail risk values suggest reducing leverage.",
      },
      {
        q: "What is the crypto/equity vol ratio?",
        a: "It compares average annualized volatility across crypto assets vs equity assets. A ratio of 6x means crypto is approximately 6 times more volatile than equities according to Synth's forecasts. This is useful for cross-asset portfolio construction.",
      },
    ],
  },
];

export default function FAQPage() {
  const [openIdx, setOpenIdx] = useState<string | null>(null);

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-mono text-xl font-bold text-text-primary tracking-wider">
          {"// HELP & FAQ"}
        </h1>
        <span className="font-mono text-[9px] text-neon-green tracking-wider">[GUIDE]</span>
      </div>

      <div className="bg-bg-secondary border border-border-dim p-4">
        <p className="font-mono text-[11px] text-text-secondary tracking-wider leading-relaxed">
          SYNTHEDGE IS A PROBABILISTIC TRADING TERMINAL BUILT FOR THE SYNTH
          HACKATHON 2026. IT FETCHES AI-POWERED PRICE FORECASTS FROM THE SYNTH
          API AND DERIVES ACTIONABLE INTELLIGENCE: VOLATILITY, DIRECTION,
          REGIME, AND RISK METRICS. ALL DATA IS PROBABILITY-BASED — NOT POINT
          PREDICTIONS.
        </p>
      </div>

      {FAQ_SECTIONS.map((section) => (
        <div key={section.category} className="bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim">
            <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// "}{section.category}
            </h2>
          </div>
          <div>
            {section.items.map((item, idx) => {
              const key = `${section.category}-${idx}`;
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
                    <div className="px-4 pb-3">
                      <p className="font-mono text-[10px] text-text-secondary leading-relaxed tracking-wider">
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
