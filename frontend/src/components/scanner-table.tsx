"use client";

import { useScanner } from "@/hooks/useSynth";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useRouter } from "next/navigation";
import { formatPrice, formatPercent, formatVol, cn, ASSET_LABELS } from "@/lib/utils";

export function ScannerTable() {
  const { data, isLoading } = useScanner();
  const setSelectedAsset = useSettingsStore((s) => s.setSelectedAsset);
  const selectedAsset = useSettingsStore((s) => s.selectedAsset);
  const router = useRouter();

  const scanner = data?.data || [];

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="h-8 bg-neon-green/5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-mono">
        <thead>
          <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-border-dim">
            <th className="text-left px-4 py-2">ASSET</th>
            <th className="text-right px-4 py-2">PRICE</th>
            <th className="text-center px-4 py-2">DIRECTION</th>
            <th className="text-right px-4 py-2">PROBABILITY</th>
            <th className="text-right px-4 py-2">IMPLIED_VOL</th>
            <th className="text-center px-4 py-2">REGIME</th>
            <th className="text-right px-4 py-2">SKEW</th>
            <th className="text-center px-4 py-2">ACTION</th>
          </tr>
        </thead>
        <tbody>
          {scanner.map((item: any) => {
            const isBullish = item.direction === "bullish";
            const isSelected = item.asset === selectedAsset;
            return (
              <tr
                key={item.asset}
                onClick={() => setSelectedAsset(item.asset)}
                className={cn(
                  "border-t border-border-dim cursor-pointer transition-colors",
                  isSelected
                    ? "bg-neon-green/5 border-l-2 border-l-neon-green"
                    : "hover:bg-bg-hover border-l-2 border-l-transparent"
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-text-primary text-[11px] tracking-wider">
                      {item.asset}
                    </span>
                    <span className="text-[9px] text-text-muted hidden sm:inline tracking-wider">
                      {ASSET_LABELS[item.asset]}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-primary text-[11px]">
                  ${formatPrice(item.current_price)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-semibold border tracking-wider",
                      isBullish
                        ? "border-bull/30 text-bull bg-bull/5"
                        : "border-bear/30 text-bear bg-bear/5"
                    )}
                  >
                    {isBullish ? "▲ BULL" : "▼ BEAR"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1 bg-bg-tertiary hidden lg:block">
                      <div
                        className={cn(
                          "h-full transition-all",
                          item.up_probability > 0.6
                            ? "bg-bull/60"
                            : item.up_probability < 0.4
                            ? "bg-bear/60"
                            : "bg-neutral/60"
                        )}
                        style={{ width: `${item.up_probability * 100}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        "font-mono tabular-nums font-semibold text-[11px]",
                        item.up_probability > 0.6
                          ? "text-bull"
                          : item.up_probability < 0.4
                          ? "text-bear"
                          : "text-neutral"
                      )}
                    >
                      {formatPercent(item.up_probability)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-secondary text-[11px]">
                  {formatVol(item.implied_vol)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span
                    className={cn(
                      "text-[9px] font-mono px-1.5 py-0.5 border tracking-wider",
                      item.regime === "tail_risk"
                        ? "border-bear/30 text-bear bg-bear/5"
                        : item.regime === "high_vol_trend"
                        ? "border-warning/30 text-warning bg-warning/5"
                        : item.regime === "low_vol_grind"
                        ? "border-bull/30 text-bull bg-bull/5"
                        : "border-neutral/30 text-neutral bg-neutral/5"
                    )}
                  >
                    [{item.regime?.replace(/_/g, " ").toUpperCase()}]
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-text-secondary text-[11px]">
                  {item.skew > 0 ? "+" : ""}
                  {item.skew?.toFixed(3)}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/terminal/asset/${item.asset}`);
                    }}
                    className="px-2 py-1 bg-neon-green/10 text-neon-green border border-neon-green/20 text-[10px] font-mono tracking-wider hover:bg-neon-green/20 transition-colors"
                  >
                    ANALYZE
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {scanner.length === 0 && (
        <div className="p-8 text-center text-text-muted font-mono text-[11px] tracking-wider">
          NO DATA AVAILABLE. START THE BACKEND OR CHECK YOUR API KEY.
        </div>
      )}
    </div>
  );
}
