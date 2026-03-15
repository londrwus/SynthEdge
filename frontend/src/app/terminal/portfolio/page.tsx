"use client";

import { PortfolioSection } from "@/components/portfolio-section";

export default function PortfolioPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-text-primary tracking-wider uppercase">
          {"// PORTFOLIO"}
        </h1>
        <span className="font-mono text-[9px] text-text-muted tracking-wider">[HYPERLIQUID READ-ONLY]</span>
      </div>
      <PortfolioSection />
      <div className="bg-bg-secondary border border-border-dim p-4">
        <p className="font-mono text-[10px] text-text-muted tracking-wider">
          // DISCLAIMER: HYPERLIQUID IS NOT AVAILABLE IN USA, UK, OR SANCTIONED COUNTRIES.
          THIS VIEW IS READ-ONLY. NO PRIVATE KEYS ARE USED OR STORED.
          TRADE EXECUTION HAPPENS DIRECTLY ON HYPERLIQUID VIA DEEP LINKS.
        </p>
      </div>
    </div>
  );
}
