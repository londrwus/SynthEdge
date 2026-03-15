"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { formatPrice, formatPercent, formatVol, ASSETS, ASSET_LABELS, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/**
 * SIGNALS & ALERTS
 *
 * Generates actionable trading signals from Synth's probability distributions:
 * - High conviction directional signals (>60% probability)
 * - Regime change alerts
 * - Vol spike detection
 * - Timeframe confluence signals
 * - Tail risk warnings
 */

interface Signal {
  asset: string;
  type: string;
  severity: "high" | "medium" | "low";
  direction?: "bullish" | "bearish";
  message: string;
  metric: string;
  value: string;
}

export default function SignalsPage() {
  const horizon = useSettingsStore((s) => s.horizon);
  const router = useRouter();

  const { data: scannerRes } = useQuery({
    queryKey: ["scanner", "24h"],
    queryFn: () => api.getScanner("24h"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: scanner1hRes } = useQuery({
    queryKey: ["scanner", "1h"],
    queryFn: () => api.getScanner("1h"),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: volRes } = useQuery({
    queryKey: ["cross-asset-vol"],
    queryFn: () => api.getCrossAssetVol(),
    refetchInterval: 60_000,
  });

  const scanner24h = scannerRes?.data || [];
  const scanner1h = scanner1hRes?.data || [];

  // Generate signals
  const signals: Signal[] = [];

  // 1. High conviction directional signals
  scanner24h.forEach((a: any) => {
    if (a.up_probability > 0.62) {
      signals.push({
        asset: a.asset,
        type: "DIRECTION",
        severity: a.up_probability > 0.7 ? "high" : "medium",
        direction: "bullish",
        message: `Strong bullish signal — ${(a.up_probability * 100).toFixed(0)}% up probability with ${(a.conviction * 100).toFixed(0)}% conviction`,
        metric: "UP_PROB",
        value: formatPercent(a.up_probability),
      });
    } else if (a.up_probability < 0.38) {
      signals.push({
        asset: a.asset,
        type: "DIRECTION",
        severity: a.up_probability < 0.3 ? "high" : "medium",
        direction: "bearish",
        message: `Strong bearish signal — only ${(a.up_probability * 100).toFixed(0)}% up probability`,
        metric: "UP_PROB",
        value: formatPercent(a.up_probability),
      });
    }
  });

  // 2. Tail risk warnings
  scanner24h.forEach((a: any) => {
    if (a.regime === "tail_risk") {
      signals.push({
        asset: a.asset,
        type: "TAIL_RISK",
        severity: "high",
        message: `Tail risk regime detected — fat tails in distribution. Reduce leverage.`,
        metric: "REGIME",
        value: "TAIL_RISK",
      });
    }
  });

  // 3. Vol spike (>50% annualized)
  scanner24h.forEach((a: any) => {
    if (a.implied_vol > 0.5) {
      signals.push({
        asset: a.asset,
        type: "VOL_SPIKE",
        severity: "medium",
        message: `Elevated volatility at ${formatVol(a.implied_vol)} annualized — wider distribution than normal`,
        metric: "IMPLIED_VOL",
        value: formatVol(a.implied_vol),
      });
    }
  });

  // 4. Timeframe confluence (1h + 24h agree)
  scanner24h.forEach((a24: any) => {
    const a1h = scanner1h.find((x: any) => x.asset === a24.asset);
    if (a1h && a1h.direction === a24.direction && a24.conviction > 0.3) {
      signals.push({
        asset: a24.asset,
        type: "CONFLUENCE",
        severity: "medium",
        direction: a24.direction,
        message: `1H + 24H both ${a24.direction.toUpperCase()} — higher conviction multi-timeframe signal`,
        metric: "CONFLUENCE",
        value: `${a24.direction.toUpperCase()}`,
      });
    } else if (a1h && a1h.direction !== a24.direction) {
      signals.push({
        asset: a24.asset,
        type: "DIVERGENCE",
        severity: "low",
        message: `Timeframe divergence: 1H ${a1h.direction} vs 24H ${a24.direction} — conflicting signals`,
        metric: "DIVERGENCE",
        value: `1H≠24H`,
      });
    }
  });

  // 5. High skew (distribution asymmetry)
  scanner24h.forEach((a: any) => {
    if (Math.abs(a.skew) > 0.15) {
      signals.push({
        asset: a.asset,
        type: "SKEW",
        severity: "low",
        direction: a.skew > 0 ? "bullish" : "bearish",
        message: `${a.skew > 0 ? "Positive" : "Negative"} skew (${a.skew.toFixed(3)}) — distribution is ${a.skew > 0 ? "upside" : "downside"} heavy`,
        metric: "SKEW",
        value: a.skew.toFixed(3),
      });
    }
  });

  // Sort: high severity first, then medium, then low
  const severityOrder = { high: 0, medium: 1, low: 2 };
  signals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const highCount = signals.filter((s) => s.severity === "high").length;
  const medCount = signals.filter((s) => s.severity === "medium").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-text-primary tracking-wider">
          {"// SIGNALS & ALERTS"}
        </h1>
        <div className="flex items-center gap-3">
          {highCount > 0 && (
            <span className="font-mono text-[10px] text-bear tracking-wider px-2 py-0.5 border border-bear/30 bg-bear/5">
              {highCount} HIGH
            </span>
          )}
          {medCount > 0 && (
            <span className="font-mono text-[10px] text-warning tracking-wider px-2 py-0.5 border border-warning/30 bg-warning/5">
              {medCount} MEDIUM
            </span>
          )}
          <span className="font-mono text-[10px] text-text-muted tracking-wider">
            {signals.length} TOTAL
          </span>
        </div>
      </div>

      {/* Signal Legend */}
      <div className="bg-bg-secondary border border-border-dim p-3 flex flex-wrap gap-4">
        {[
          { type: "DIRECTION", desc: "HIGH PROBABILITY DIRECTIONAL SIGNAL" },
          { type: "CONFLUENCE", desc: "MULTI-TIMEFRAME AGREEMENT" },
          { type: "TAIL_RISK", desc: "FAT TAIL DISTRIBUTION WARNING" },
          { type: "VOL_SPIKE", desc: "ELEVATED VOLATILITY" },
          { type: "SKEW", desc: "DISTRIBUTION ASYMMETRY" },
          { type: "DIVERGENCE", desc: "TIMEFRAME DISAGREEMENT" },
        ].map(({ type, desc }) => (
          <span key={type} className="font-mono text-[8px] text-text-muted tracking-wider">
            [{type}] {desc}
          </span>
        ))}
      </div>

      {/* Signal Cards */}
      {signals.length === 0 ? (
        <div className="bg-bg-secondary border border-border-dim p-8 text-center">
          <p className="font-mono text-[11px] text-text-muted tracking-wider">
            NO ACTIVE SIGNALS. MARKET CONDITIONS ARE NEUTRAL.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((signal, idx) => (
            <div
              key={`${signal.asset}-${signal.type}-${idx}`}
              className={cn(
                "bg-bg-secondary border p-3 flex items-center gap-4 cursor-pointer hover:bg-bg-hover transition-colors",
                signal.severity === "high" ? "border-bear/30" :
                signal.severity === "medium" ? "border-warning/30" :
                "border-border-dim"
              )}
              onClick={() => router.push(`/terminal/asset/${signal.asset}`)}
            >
              {/* Severity */}
              <div className={cn(
                "w-2 h-full min-h-[40px] shrink-0",
                signal.severity === "high" ? "bg-bear" :
                signal.severity === "medium" ? "bg-warning" :
                "bg-text-muted"
              )} />

              {/* Asset */}
              <div className="w-16 shrink-0">
                <p className="font-mono text-[13px] font-bold text-text-primary tracking-wider">
                  {signal.asset}
                </p>
                <p className="font-mono text-[8px] text-text-muted tracking-wider">
                  {ASSET_LABELS[signal.asset]}
                </p>
              </div>

              {/* Type Badge */}
              <div className="w-24 shrink-0">
                <span className={cn(
                  "font-mono text-[9px] tracking-wider px-2 py-0.5 border",
                  signal.type === "DIRECTION" && signal.direction === "bullish" ? "border-bull/30 text-bull bg-bull/5" :
                  signal.type === "DIRECTION" && signal.direction === "bearish" ? "border-bear/30 text-bear bg-bear/5" :
                  signal.type === "TAIL_RISK" ? "border-bear/30 text-bear bg-bear/5" :
                  signal.type === "CONFLUENCE" ? "border-neon-green/30 text-neon-green bg-neon-green/5" :
                  signal.type === "VOL_SPIKE" ? "border-warning/30 text-warning bg-warning/5" :
                  "border-border-dim text-text-secondary"
                )}>
                  [{signal.type}]
                </span>
              </div>

              {/* Message */}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[10px] text-text-secondary tracking-wider truncate">
                  {signal.message}
                </p>
              </div>

              {/* Value */}
              <div className="w-20 shrink-0 text-right">
                <p className={cn(
                  "font-mono text-[11px] font-bold tracking-wider tabular-nums",
                  signal.direction === "bullish" ? "text-bull" :
                  signal.direction === "bearish" ? "text-bear" :
                  signal.severity === "high" ? "text-bear" :
                  "text-text-primary"
                )}>
                  {signal.value}
                </p>
              </div>

              {/* Arrow */}
              <span className="font-mono text-[10px] text-text-muted shrink-0">→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
