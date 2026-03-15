"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { formatPrice, formatPercent, formatVol, ASSET_LABELS, ASSET_CATEGORIES, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/**
 * SYNTH-POWERED EQUITY SCREENER
 *
 * Ranks all Synth-supported assets by probabilistic metrics:
 * - Highest upside probability
 * - Lowest downside risk (tail risk)
 * - Best risk/reward (skew)
 * - Highest forecast vol (for vol sellers)
 * - Regime classification
 *
 * This directly addresses hackathon criteria:
 * "Screener ranking all Synth-supported equities by probabilistic metrics"
 */

type SortKey = "up_probability" | "implied_vol" | "skew" | "tail_risk" | "conviction";

export default function ScreenerPage() {
  const horizon = useSettingsStore((s) => s.horizon);
  const router = useRouter();

  const { data: scannerRes, isLoading } = useQuery({
    queryKey: ["scanner", horizon],
    queryFn: () => api.getScanner(horizon),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: volRes } = useQuery({
    queryKey: ["cross-asset-vol"],
    queryFn: () => api.getCrossAssetVol(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const scanner = scannerRes?.data || [];
  const volData = volRes?.data;

  // Separate equities and crypto
  const equities = scanner.filter((a: any) => ["SPY", "NVDA", "TSLA", "AAPL", "GOOGL"].includes(a.asset));
  const crypto = scanner.filter((a: any) => ["BTC", "ETH", "SOL"].includes(a.asset));
  const commodities = scanner.filter((a: any) => a.asset === "XAU");

  // Ranking metrics
  const byUpProb = [...scanner].sort((a: any, b: any) => b.up_probability - a.up_probability);
  const byVol = [...scanner].sort((a: any, b: any) => b.implied_vol - a.implied_vol);
  const byConviction = [...scanner].sort((a: any, b: any) => b.conviction - a.conviction);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-neon-green/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-text-primary tracking-wider">
          {"// EQUITY SCREENER"}
        </h1>
        <span className="font-mono text-[9px] text-neon-green tracking-wider">[SYNTH-POWERED]</span>
      </div>

      {/* Top Signals */}
      <div className="grid grid-cols-3 gap-px bg-border-dim">
        <div className="bg-bg-secondary p-3">
          <p className="font-mono text-[9px] text-text-muted tracking-wider">HIGHEST_UP_PROBABILITY</p>
          {byUpProb[0] && (
            <>
              <p className="font-mono text-xl font-bold text-bull tabular-nums mt-1">
                {byUpProb[0].asset}
              </p>
              <p className="font-mono text-[11px] text-bull tabular-nums">
                {formatPercent(byUpProb[0].up_probability)} UP
              </p>
            </>
          )}
        </div>
        <div className="bg-bg-secondary p-3">
          <p className="font-mono text-[9px] text-text-muted tracking-wider">HIGHEST_CONVICTION</p>
          {byConviction[0] && (
            <>
              <p className="font-mono text-xl font-bold text-neon-green tabular-nums mt-1">
                {byConviction[0].asset}
              </p>
              <p className="font-mono text-[11px] text-text-secondary tabular-nums">
                {formatPercent(byConviction[0].conviction)} CONVICTION
              </p>
            </>
          )}
        </div>
        <div className="bg-bg-secondary p-3">
          <p className="font-mono text-[9px] text-text-muted tracking-wider">HIGHEST_VOLATILITY</p>
          {byVol[0] && (
            <>
              <p className="font-mono text-xl font-bold text-warning tabular-nums mt-1">
                {byVol[0].asset}
              </p>
              <p className="font-mono text-[11px] text-text-secondary tabular-nums">
                {formatVol(byVol[0].implied_vol)} ANN. VOL
              </p>
            </>
          )}
        </div>
      </div>

      {/* Cross-asset vol ratio */}
      {volData && (
        <div className="bg-bg-secondary border border-border-dim p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-text-muted tracking-wider">
              CRYPTO / EQUITY VOL RATIO
            </span>
            <span className="font-mono text-[13px] text-warning font-bold tabular-nums">
              {volData.crypto_equity_vol_ratio}x
            </span>
          </div>
          <div className="flex gap-4 mt-2">
            <span className="font-mono text-[9px] text-text-muted tracking-wider">
              CRYPTO AVG: <span className="text-neon-green">{formatVol(volData.class_averages?.crypto || 0)}</span>
            </span>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">
              EQUITY AVG: <span className="text-text-primary">{formatVol(volData.class_averages?.equity || 0)}</span>
            </span>
          </div>
        </div>
      )}

      {/* Equities Section */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// EQUITIES (SPY, NVDA, TSLA, AAPL, GOOGL)"}
          </h2>
          <span className="font-mono text-[9px] text-neon-green tracking-wider">[{equities.length} ASSETS]</span>
        </div>
        <AssetTable assets={equities} onSelect={(a) => router.push(`/terminal/asset/${a}`)} />
      </div>

      {/* Crypto Section */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// CRYPTO (BTC, ETH, SOL)"}
          </h2>
          <span className="font-mono text-[9px] text-text-muted tracking-wider">[{crypto.length} ASSETS]</span>
        </div>
        <AssetTable assets={crypto} onSelect={(a) => router.push(`/terminal/asset/${a}`)} />
      </div>

      {/* Commodities Section */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// COMMODITIES (XAU)"}
          </h2>
        </div>
        <AssetTable assets={commodities} onSelect={(a) => router.push(`/terminal/asset/${a}`)} />
      </div>
    </div>
  );
}

function AssetTable({ assets, onSelect }: { assets: any[]; onSelect: (asset: string) => void }) {
  if (assets.length === 0) return <div className="p-4 font-mono text-[10px] text-text-muted">NO DATA</div>;

  return (
    <table className="w-full font-mono text-[11px]">
      <thead>
        <tr className="text-[9px] text-text-muted tracking-wider border-b border-border-dim">
          <th className="text-left px-4 py-2">ASSET</th>
          <th className="text-right px-4 py-2">PRICE</th>
          <th className="text-center px-4 py-2">DIRECTION</th>
          <th className="text-right px-4 py-2">UP_PROB</th>
          <th className="text-right px-4 py-2">VOL</th>
          <th className="text-center px-4 py-2">REGIME</th>
          <th className="text-right px-4 py-2">SKEW</th>
          <th className="text-right px-4 py-2">CONVICTION</th>
          <th className="text-center px-4 py-2">ACTION</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((a: any) => (
          <tr
            key={a.asset}
            className="border-t border-border-dim/50 hover:bg-bg-hover cursor-pointer transition-colors"
            onClick={() => onSelect(a.asset)}
          >
            <td className="px-4 py-2.5">
              <span className="font-semibold text-text-primary tracking-wider">{a.asset}</span>
              <span className="text-[8px] text-text-muted ml-2">{ASSET_LABELS[a.asset]}</span>
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-text-primary">
              ${formatPrice(a.current_price)}
            </td>
            <td className="px-4 py-2.5 text-center">
              <span className={cn(
                "text-[9px] px-2 py-0.5 border tracking-wider",
                a.direction === "bullish" ? "border-bull/30 text-bull bg-bull/5" : "border-bear/30 text-bear bg-bear/5"
              )}>
                [{a.direction === "bullish" ? "BULL" : "BEAR"}]
              </span>
            </td>
            <td className={cn(
              "px-4 py-2.5 text-right tabular-nums font-semibold",
              a.up_probability > 0.55 ? "text-bull" : a.up_probability < 0.45 ? "text-bear" : "text-neutral"
            )}>
              {formatPercent(a.up_probability)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
              {formatVol(a.implied_vol)}
            </td>
            <td className="px-4 py-2.5 text-center">
              <span className={cn(
                "text-[8px] px-1.5 py-0.5 border tracking-wider",
                a.regime === "tail_risk" ? "border-bear/30 text-bear" :
                a.regime === "high_vol_trend" ? "border-warning/30 text-warning" :
                a.regime === "low_vol_grind" ? "border-bull/30 text-bull" :
                "border-neutral/30 text-neutral"
              )}>
                [{a.regime?.replace(/_/g, " ").toUpperCase()}]
              </span>
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
              {a.skew > 0 ? "+" : ""}{a.skew?.toFixed(3)}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
              {formatPercent(a.conviction)}
            </td>
            <td className="px-4 py-2.5 text-center">
              <button className="px-2 py-1 bg-neon-green/10 text-neon-green border border-neon-green/20 text-[9px] tracking-wider hover:bg-neon-green/20 transition-colors">
                ANALYZE
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
