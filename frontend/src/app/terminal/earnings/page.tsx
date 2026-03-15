"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { formatPrice, formatPercent, formatVol, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/**
 * EARNINGS VOLATILITY DASHBOARD
 *
 * Directly addresses the hackathon criterion:
 * "Earnings volatility dashboard comparing Synth's forecasts
 *  against historical moves for NVDA, TSLA, AAPL, GOOGL"
 *
 * Shows:
 * 1. Synth's current forecast expected move for each equity
 * 2. Historical average earnings-day moves (last 6 quarters)
 * 3. Vol ratio: current vs historical (elevated/compressed/normal)
 * 4. Per-quarter earnings history with direction
 */

export default function EarningsPage() {
  const horizon = useSettingsStore((s) => s.horizon);
  const router = useRouter();

  const { data: res, isLoading } = useQuery({
    queryKey: ["earnings", horizon],
    queryFn: () => api.getEarningsDashboard(horizon),
    staleTime: 30_000,
  });

  const assets = res?.data?.assets || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-48 bg-neon-green/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-text-primary tracking-wider">
          {"// EARNINGS VOLATILITY"}
        </h1>
        <span className="font-mono text-[9px] text-neon-green tracking-wider">
          [SYNTH FORECAST vs HISTORICAL]
        </span>
      </div>

      {/* Description */}
      <div className="bg-bg-secondary border border-border-dim p-4">
        <p className="font-mono text-[10px] text-text-secondary tracking-wider leading-relaxed">
          COMPARES SYNTH&apos;S CURRENT FORECAST VOLATILITY AGAINST HISTORICAL
          EARNINGS-DAY MOVES FOR EQUITY ASSETS. WHEN CURRENT VOL DEVIATES FROM
          HISTORICAL PATTERNS, IT MAY SIGNAL UNUSUAL MARKET CONDITIONS OR
          POSITIONING OPPORTUNITIES.
        </p>
      </div>

      {/* Asset Cards */}
      {assets.filter((a: any) => a.historical.num_quarters > 0).map((asset: any) => (
        <div key={asset.asset} className="bg-bg-secondary border border-border-dim">
          {/* Asset Header */}
          <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="font-mono text-[14px] font-bold text-text-primary tracking-wider">
                {asset.asset}
              </h2>
              <span className="font-mono text-[10px] text-text-muted tracking-wider">
                {asset.name}
              </span>
              <span className="font-mono text-[12px] text-text-primary tabular-nums">
                ${formatPrice(asset.current_price)}
              </span>
              <span className={cn(
                "font-mono text-[10px] px-2 py-0.5 border tracking-wider",
                asset.synth.direction === "bullish"
                  ? "border-bull/30 text-bull bg-bull/5"
                  : "border-bear/30 text-bear bg-bear/5"
              )}>
                [{asset.synth.direction.toUpperCase()}] {formatPercent(asset.synth.up_probability)} UP
              </span>
            </div>
            <div className="flex items-center gap-3">
              {asset.next_earnings && (
                <span className="font-mono text-[9px] text-text-muted tracking-wider">
                  NEXT EARNINGS: {asset.next_earnings}
                </span>
              )}
              <span className={cn(
                "font-mono text-[10px] px-2 py-0.5 border tracking-wider font-bold",
                asset.comparison.signal === "ELEVATED"
                  ? "border-warning/30 text-warning bg-warning/5"
                  : asset.comparison.signal === "COMPRESSED"
                  ? "border-bull/30 text-bull bg-bull/5"
                  : "border-border-dim text-text-secondary"
              )}>
                [{asset.comparison.signal}]
              </span>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Column 1: Synth Forecast */}
              <div className="space-y-3">
                <h3 className="font-mono text-[10px] text-text-muted tracking-wider">
                  // SYNTH FORECAST ({horizon.toUpperCase()})
                </h3>

                <div className="grid grid-cols-2 gap-px bg-border-dim">
                  <div className="bg-bg-tertiary p-2.5">
                    <p className="font-mono text-[8px] text-text-muted tracking-wider">IMPLIED_VOL</p>
                    <p className="font-mono text-[16px] text-neon-green font-bold tabular-nums">
                      {formatVol(asset.synth.implied_vol_annualized)}
                    </p>
                    <p className="font-mono text-[8px] text-text-muted tracking-wider">ANNUALIZED</p>
                  </div>
                  <div className="bg-bg-tertiary p-2.5">
                    <p className="font-mono text-[8px] text-text-muted tracking-wider">EXPECTED_MOVE</p>
                    <p className="font-mono text-[16px] text-text-primary font-bold tabular-nums">
                      {asset.synth.expected_move_24h_pct.toFixed(2)}%
                    </p>
                    <p className="font-mono text-[8px] text-text-muted tracking-wider">24H RANGE</p>
                  </div>
                </div>

                {/* Expected range */}
                <div className="p-2 border border-border-dim bg-bg-tertiary">
                  <p className="font-mono text-[8px] text-text-muted tracking-wider mb-1">
                    90% CONFIDENCE RANGE
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-bear tabular-nums">
                      ${formatPrice(asset.synth.expected_move_24h_range.low)}
                    </span>
                    <div className="flex-1 mx-3 h-2 bg-bg-primary relative">
                      <div className="absolute inset-y-0 left-[5%] right-[5%] bg-neon-green/15" />
                      <div className="absolute inset-y-0 left-[20%] right-[20%] bg-neon-green/25" />
                      <div className="absolute inset-y-0 left-[35%] right-[35%] bg-neon-green/40" />
                    </div>
                    <span className="font-mono text-[11px] text-bull tabular-nums">
                      ${formatPrice(asset.synth.expected_move_24h_range.high)}
                    </span>
                  </div>
                </div>

                <div className="p-2 border border-border-dim">
                  <span className={cn(
                    "font-mono text-[9px] tracking-wider",
                    asset.synth.regime === "tail_risk" ? "text-bear" :
                    asset.synth.regime === "high_vol_trend" ? "text-warning" :
                    asset.synth.regime === "low_vol_grind" ? "text-bull" :
                    "text-text-secondary"
                  )}>
                    REGIME: [{asset.synth.regime.replace(/_/g, " ").toUpperCase()}]
                  </span>
                </div>
              </div>

              {/* Column 2: Historical Earnings Moves */}
              <div className="space-y-3">
                <h3 className="font-mono text-[10px] text-text-muted tracking-wider">
                  // HISTORICAL EARNINGS ({asset.historical.num_quarters} QUARTERS)
                </h3>

                <div className="grid grid-cols-3 gap-px bg-border-dim">
                  <div className="bg-bg-tertiary p-2.5 text-center">
                    <p className="font-mono text-[8px] text-text-muted tracking-wider">AVG_MOVE</p>
                    <p className="font-mono text-[16px] text-warning font-bold tabular-nums">
                      {asset.historical.avg_earnings_move_pct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-bg-tertiary p-2.5 text-center">
                    <p className="font-mono text-[8px] text-text-muted tracking-wider">MAX_MOVE</p>
                    <p className="font-mono text-[16px] text-bear font-bold tabular-nums">
                      {asset.historical.max_earnings_move_pct.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-bg-tertiary p-2.5 text-center">
                    <p className="font-mono text-[8px] text-text-muted tracking-wider">BEAT_RATE</p>
                    <p className="font-mono text-[16px] text-bull font-bold tabular-nums">
                      {(asset.historical.earnings_up_pct * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                {/* Recent quarters */}
                <div className="space-y-1">
                  {asset.historical.recent_moves.map((move: any, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-text-muted w-20 tracking-wider">
                        {move.quarter}
                      </span>
                      <div className="flex-1 h-4 bg-bg-tertiary relative">
                        <div
                          className={cn(
                            "h-full transition-all",
                            move.direction === "up" ? "bg-bull/30" : "bg-bear/30"
                          )}
                          style={{ width: `${Math.min(move.move_pct / 25 * 100, 100)}%` }}
                        />
                      </div>
                      <span className={cn(
                        "font-mono text-[10px] tabular-nums w-14 text-right font-semibold",
                        move.direction === "up" ? "text-bull" : "text-bear"
                      )}>
                        {move.direction === "up" ? "+" : "-"}{move.move_pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 3: Comparison */}
              <div className="space-y-3">
                <h3 className="font-mono text-[10px] text-text-muted tracking-wider">
                  // FORECAST vs HISTORICAL
                </h3>

                {/* Vol Ratio Gauge */}
                <div className={cn(
                  "p-3 border text-center",
                  asset.comparison.signal === "ELEVATED"
                    ? "border-warning/30 bg-warning/5"
                    : asset.comparison.signal === "COMPRESSED"
                    ? "border-bull/30 bg-bull/5"
                    : "border-border-dim bg-bg-tertiary"
                )}>
                  <p className="font-mono text-[8px] text-text-muted tracking-wider">VOL_RATIO</p>
                  <p className={cn(
                    "font-mono text-[28px] font-bold tabular-nums",
                    asset.comparison.signal === "ELEVATED" ? "text-warning" :
                    asset.comparison.signal === "COMPRESSED" ? "text-bull" :
                    "text-text-primary"
                  )}>
                    {asset.comparison.vol_ratio.toFixed(2)}x
                  </p>
                  <p className="font-mono text-[9px] text-text-muted tracking-wider mt-1">
                    SYNTH / HISTORICAL
                  </p>
                </div>

                {/* Interpretation */}
                <div className="p-2 border border-border-dim">
                  <p className="font-mono text-[9px] text-text-secondary tracking-wider leading-relaxed">
                    {asset.comparison.interpretation}
                  </p>
                </div>

                {/* Synth vs Avg comparison bar */}
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[9px] tracking-wider">
                    <span className="text-text-muted">SYNTH EXPECTED MOVE</span>
                    <span className="text-neon-green">{asset.synth.expected_move_24h_pct.toFixed(2)}%</span>
                  </div>
                  <div className="h-3 bg-bg-tertiary w-full relative">
                    <div
                      className="h-full bg-neon-green/30"
                      style={{ width: `${Math.min(asset.synth.expected_move_24h_pct / 20 * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[9px] tracking-wider">
                    <span className="text-text-muted">HIST AVG EARNINGS MOVE</span>
                    <span className="text-warning">{asset.historical.avg_earnings_move_pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-bg-tertiary w-full relative">
                    <div
                      className="h-full bg-warning/30"
                      style={{ width: `${Math.min(asset.historical.avg_earnings_move_pct / 20 * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Action */}
                <button
                  onClick={() => router.push(`/terminal/asset/${asset.asset}`)}
                  className="w-full py-2 bg-neon-green/10 text-neon-green border border-neon-green/20 font-mono text-[10px] tracking-wider hover:bg-neon-green/20 transition-all"
                >
                  ANALYZE {asset.asset}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* SPY Benchmark Note */}
      {assets.find((a: any) => a.asset === "SPY") && (
        <div className="bg-bg-secondary border border-border-dim p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-mono text-[11px] text-text-primary tracking-wider font-bold">
              SPY — S&P 500 BENCHMARK
            </h3>
            <span className="font-mono text-[10px] text-text-muted tracking-wider">
              INDEX — NO EARNINGS
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border-dim">
            <div className="bg-bg-tertiary p-2.5 text-center">
              <p className="font-mono text-[8px] text-text-muted tracking-wider">IMPLIED_VOL</p>
              <p className="font-mono text-[14px] text-neon-green font-bold tabular-nums">
                {formatVol(assets.find((a: any) => a.asset === "SPY")?.synth.implied_vol_annualized || 0)}
              </p>
            </div>
            <div className="bg-bg-tertiary p-2.5 text-center">
              <p className="font-mono text-[8px] text-text-muted tracking-wider">EXPECTED_MOVE</p>
              <p className="font-mono text-[14px] text-text-primary font-bold tabular-nums">
                {assets.find((a: any) => a.asset === "SPY")?.synth.expected_move_24h_pct.toFixed(2)}%
              </p>
            </div>
            <div className="bg-bg-tertiary p-2.5 text-center">
              <p className="font-mono text-[8px] text-text-muted tracking-wider">REGIME</p>
              <p className="font-mono text-[12px] text-text-secondary font-bold tracking-wider">
                [{assets.find((a: any) => a.asset === "SPY")?.synth.regime.replace(/_/g, " ").toUpperCase()}]
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
