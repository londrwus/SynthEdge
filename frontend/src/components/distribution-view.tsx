"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface DistributionViewProps {
  asset: string;
}

export function DistributionView({ asset }: DistributionViewProps) {
  const horizon = useSettingsStore((s) => s.horizon);
  const { data: res, isLoading } = useQuery({
    queryKey: ["distribution", asset, horizon],
    queryFn: () => api.getDistribution(asset, horizon),
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-5 bg-neon-green/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const data = res?.data;
  if (!data) {
    return (
      <div className="font-mono text-[10px] text-text-muted tracking-wider text-center p-4">
        NO DISTRIBUTION DATA
      </div>
    );
  }

  const returns = data.percentile_returns_pct || {};
  const ci = data.confidence_intervals || {};
  const skew = data.skew_analysis || {};

  // Build distribution bars
  const percentiles = [
    { key: "0.005", label: "P0.5", color: "bg-bear/60" },
    { key: "0.05", label: "P5", color: "bg-bear/40" },
    { key: "0.2", label: "P20", color: "bg-bear/20" },
    { key: "0.35", label: "P35", color: "bg-text-muted/20" },
    { key: "0.5", label: "P50", color: "bg-neon-green/40" },
    { key: "0.65", label: "P65", color: "bg-text-muted/20" },
    { key: "0.8", label: "P80", color: "bg-bull/20" },
    { key: "0.95", label: "P95", color: "bg-bull/40" },
    { key: "0.995", label: "P99.5", color: "bg-bull/60" },
  ];

  const maxAbs = Math.max(
    ...Object.values(returns).map((v) => Math.abs(v as number)),
    0.01
  );

  return (
    <div className="space-y-3">
      {/* Distribution Histogram */}
      <div className="space-y-1">
        {percentiles.map(({ key, label, color }) => {
          const ret = (returns[key] as number) || 0;
          const width = Math.abs(ret) / maxAbs * 50;
          const isPositive = ret >= 0;

          return (
            <div key={key} className="flex items-center gap-1 h-5">
              <span className="font-mono text-[8px] text-text-muted w-10 text-right tracking-wider">
                {label}
              </span>
              <div className="flex-1 flex items-center relative">
                {/* Center line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border-dim" />
                {/* Bar */}
                <div
                  className="absolute h-3.5"
                  style={{
                    left: isPositive ? "50%" : `${50 - width}%`,
                    width: `${width}%`,
                  }}
                >
                  <div className={cn("h-full", color)} />
                </div>
              </div>
              <span className={cn(
                "font-mono text-[9px] w-14 text-right tabular-nums",
                ret > 0 ? "text-bull" : ret < 0 ? "text-bear" : "text-text-muted"
              )}>
                {ret > 0 ? "+" : ""}{ret.toFixed(3)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Confidence Intervals */}
      <div className="grid grid-cols-2 gap-px bg-border-dim">
        <div className="bg-bg-tertiary p-2">
          <p className="font-mono text-[8px] text-text-muted tracking-wider">90% CI_WIDTH</p>
          <p className="font-mono text-[11px] text-text-primary font-semibold">
            {ci.ci_90?.width_pct?.toFixed(3)}%
          </p>
        </div>
        <div className="bg-bg-tertiary p-2">
          <p className="font-mono text-[8px] text-text-muted tracking-wider">60% CI_WIDTH</p>
          <p className="font-mono text-[11px] text-text-primary font-semibold">
            {ci.ci_60?.width_pct?.toFixed(3)}%
          </p>
        </div>
      </div>

      {/* Skew */}
      <div className={cn(
        "p-2 border font-mono text-[10px]",
        skew.interpretation === "upside_skewed" ? "border-bull/20 text-bull bg-bull/5" :
        skew.interpretation === "downside_skewed" ? "border-bear/20 text-bear bg-bear/5" :
        "border-border-dim text-text-secondary"
      )}>
        <span className="tracking-wider">
          SKEW: [{skew.interpretation?.toUpperCase()}] RATIO={skew.skew_ratio?.toFixed(3)}
        </span>
      </div>
    </div>
  );
}
