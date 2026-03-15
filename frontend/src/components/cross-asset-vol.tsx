"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn, formatVol } from "@/lib/utils";

export function CrossAssetVol() {
  const { data: res, isLoading } = useQuery({
    queryKey: ["cross-asset-vol"],
    queryFn: () => api.getCrossAssetVol(),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="h-6 bg-neon-green/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const data = res?.data;
  if (!data) return null;

  const classAvg = data.class_averages || {};
  const ratio = data.crypto_equity_vol_ratio;

  return (
    <div className="space-y-3">
      {/* Class Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-border-dim">
        {[
          { label: "CRYPTO_VOL", value: classAvg.crypto, color: "text-neon-green" },
          { label: "EQUITY_VOL", value: classAvg.equity, color: "text-text-primary" },
          { label: "RATIO", value: ratio ? `${ratio}x` : "—", color: "text-warning", raw: true },
        ].map((item) => (
          <div key={item.label} className="bg-bg-tertiary p-2.5 text-center">
            <p className="font-mono text-[8px] text-text-muted tracking-wider">{item.label}</p>
            <p className={cn("font-sans text-lg font-bold tabular-nums", item.color)}>
              {item.raw ? item.value : item.value ? formatVol(item.value as number) : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Asset Bars */}
      <div className="space-y-1.5">
        {(data.assets || []).map((asset: any) => {
          const vol = asset.vol_24h || 0;
          const maxVol = (data.assets?.[0]?.vol_24h || 1);
          const pct = (vol / maxVol) * 100;

          return (
            <div key={asset.asset} className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-text-secondary w-12 tracking-wider">
                {asset.asset}
              </span>
              <div className="flex-1 h-4 bg-bg-tertiary relative">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    asset.class === "crypto" ? "bg-neon-green/30" :
                    asset.class === "commodity" ? "bg-neutral/30" :
                    "bg-text-secondary/20"
                  )}
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute right-1 top-0 h-full flex items-center font-mono text-[9px] text-text-primary tabular-nums">
                  {vol ? formatVol(vol) : "—"}
                </span>
              </div>
              <span className={cn(
                "font-mono text-[8px] w-10 tracking-wider",
                asset.vol_term_ratio > 2 ? "text-warning" :
                asset.vol_term_ratio < 1 ? "text-bear" :
                "text-text-muted"
              )}>
                {asset.vol_term_ratio ? `${asset.vol_term_ratio}x` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between font-mono text-[8px] text-text-muted tracking-wider">
        <span>SORTED BY 24H VOL DESC</span>
        <span>TERM_RATIO = 24H/1H</span>
      </div>
    </div>
  );
}
