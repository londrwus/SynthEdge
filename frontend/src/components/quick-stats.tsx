"use client";

import { useAllDerived } from "@/hooks/useSynth";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { formatVol, ASSETS } from "@/lib/utils";

export function QuickStats() {
  const { data } = useAllDerived();
  const horizon = useSettingsStore((s) => s.horizon);
  const derived = data?.data || {};

  const assetData = ASSETS.map((a) => derived[a]).filter(Boolean);
  const bullishCount = assetData.filter((d: any) => d.direction === "bullish").length;
  const avgVol =
    assetData.length > 0
      ? assetData.reduce((sum: number, d: any) => sum + (d.implied_vol_annualized || 0), 0) /
        assetData.length
      : 0;

  const stats = [
    {
      label: "ASSETS_TRACKED",
      value: "9",
      sub: "ACTIVE INSTRUMENTS",
      status: "[ONLINE]",
    },
    {
      label: "BULLISH_SIGNALS",
      value: assetData.length > 0 ? `${bullishCount}` : "--",
      sub: `OF ${assetData.length || 9} ASSETS`,
      status: bullishCount > 4 ? "[RISK_ON]" : "[RISK_OFF]",
      color: bullishCount > 4 ? "text-bull" : "text-bear",
    },
    {
      label: "AVG_IMPLIED_VOL",
      value: avgVol > 0 ? formatVol(avgVol) : "--",
      sub: "ANNUALIZED",
      status: avgVol > 0.8 ? "[HIGH]" : avgVol > 0.4 ? "[MODERATE]" : "[LOW]",
    },
    {
      label: "ACTIVE_HORIZON",
      value: horizon.toUpperCase(),
      sub: horizon === "1h" ? "61 TIMESTEPS" : "289 TIMESTEPS",
      status: "[SELECTED]",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border-dim">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-bg-secondary p-3 border border-border-dim"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] tracking-wider text-text-muted uppercase">
              {stat.label}
            </span>
            <span className={`font-mono text-[9px] ${stat.color || "text-neon-green"}`}>
              {stat.status}
            </span>
          </div>
          <div className="font-sans text-2xl font-bold text-text-primary tabular-nums">
            {stat.value}
          </div>
          <div className="font-mono text-[10px] text-text-muted tracking-wider mt-1">
            {stat.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
