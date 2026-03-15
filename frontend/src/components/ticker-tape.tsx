"use client";

import { useAllDerived } from "@/hooks/useSynth";
import { formatPrice, ASSETS } from "@/lib/utils";

export function TickerTape() {
  const { data, isLoading } = useAllDerived();
  const derived = data?.data || {};

  // Only show assets that have data loaded
  const items = ASSETS
    .map((asset) => {
      const d = derived[asset];
      if (!d || !d.current_price) return null;
      return {
        asset,
        price: d.current_price,
        direction: d.direction,
        upProb: d.up_probability,
      };
    })
    .filter(Boolean) as { asset: string; price: number; direction: string; upProb: number }[];

  // Don't render ticker if no data yet
  if (items.length === 0) {
    return (
      <div className="w-full overflow-hidden border-b border-border-dim bg-bg-sidebar h-7 flex items-center px-4">
        <span className="font-mono text-[10px] text-text-muted tracking-wider animate-pulse">
          LOADING MARKET DATA...
        </span>
      </div>
    );
  }

  // Duplicate for seamless scroll
  const tickerItems = [...items, ...items];

  return (
    <div className="w-full overflow-hidden border-b border-border-dim bg-bg-sidebar">
      <div className="flex ticker-scroll whitespace-nowrap">
        {tickerItems.map((item, i) => (
          <div
            key={`${item.asset}-${i}`}
            className="inline-flex items-center gap-2 px-5 py-1.5 border-r border-border-dim/50"
          >
            <span className="font-mono text-[10px] tracking-wider text-text-muted">
              {item.asset}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-text-primary font-medium">
              ${formatPrice(item.price)}
            </span>
            <span
              className={`font-mono text-[10px] ${
                item.direction === "bullish" ? "text-bull" : "text-bear"
              }`}
            >
              {item.direction === "bullish" ? "▲" : "▼"}
            </span>
            <span
              className={`font-mono text-[9px] tabular-nums ${
                item.upProb > 0.5 ? "text-bull" : "text-bear"
              }`}
            >
              {(item.upProb * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
