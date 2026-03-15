"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatVol, cn, ASSETS } from "@/lib/utils";

export function VolatilityHeatmap() {
  const { data: data1h } = useQuery({
    queryKey: ["derived", "all", "1h"],
    queryFn: () => api.getAllDerived("1h"),
    refetchInterval: 30_000,
  });

  const { data: data24h } = useQuery({
    queryKey: ["derived", "all", "24h"],
    queryFn: () => api.getAllDerived("24h"),
    refetchInterval: 30_000,
  });

  const derived1h = data1h?.data || {};
  const derived24h = data24h?.data || {};

  // Find max vol for color scaling
  const allVols = ASSETS.flatMap((a) => [
    derived1h[a]?.implied_vol_annualized || 0,
    derived24h[a]?.implied_vol_annualized || 0,
  ]);
  const maxVol = Math.max(...allVols, 0.01);

  function volColor(vol: number): string {
    const intensity = Math.min(vol / maxVol, 1);
    if (intensity < 0.3) return "bg-neon-green/10";
    if (intensity < 0.5) return "bg-neon-green/20";
    if (intensity < 0.7) return "bg-warning/15";
    return "bg-bear/15";
  }

  return (
    <div>
      {/* Header row */}
      <div className="grid grid-cols-3 gap-px mb-px">
        <div className="font-mono text-[10px] text-text-muted px-2 py-1 tracking-wider">ASSET</div>
        <div className="font-mono text-[10px] text-text-muted text-center px-2 py-1 tracking-wider">1H_VOL</div>
        <div className="font-mono text-[10px] text-text-muted text-center px-2 py-1 tracking-wider">24H_VOL</div>
      </div>
      {/* Data rows */}
      {ASSETS.map((asset) => {
        const v1h = derived1h[asset]?.implied_vol_annualized;
        const v24h = derived24h[asset]?.implied_vol_annualized;
        return (
          <div key={asset} className="grid grid-cols-3 gap-px mb-px">
            <div className="font-mono text-[10px] text-text-primary px-2 py-1.5 flex items-center tracking-wider border-l-2 border-l-border-dim">
              {asset}
            </div>
            <div
              className={cn(
                "font-mono text-[10px] tabular-nums text-center px-2 py-1.5",
                v1h ? volColor(v1h) : "bg-bg-tertiary"
              )}
            >
              <span className="text-text-primary">
                {v1h ? formatVol(v1h) : "\u2014"}
              </span>
            </div>
            <div
              className={cn(
                "font-mono text-[10px] tabular-nums text-center px-2 py-1.5",
                v24h ? volColor(v24h) : "bg-bg-tertiary"
              )}
            >
              <span className="text-text-primary">
                {v24h ? formatVol(v24h) : "\u2014"}
              </span>
            </div>
          </div>
        );
      })}
      {/* Legend */}
      <div className="flex items-center justify-center gap-3 mt-3 font-mono text-[9px] text-text-muted tracking-wider">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-neon-green/10" /> LOW
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-neon-green/20" /> MED
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-warning/15" /> HIGH
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-bear/15" /> EXTREME
        </span>
      </div>
    </div>
  );
}
