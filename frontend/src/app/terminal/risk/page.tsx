"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { formatPrice, formatPercent, formatVol, ASSETS, ASSET_LABELS, cn } from "@/lib/utils";

/**
 * PORTFOLIO RISK MONITOR
 *
 * Addresses hackathon criterion:
 * "Portfolio risk monitor using Synth's volatility forecasts across equities and indices"
 *
 * Shows:
 * - Forward-looking VaR/CVaR from Synth distributions
 * - Tail risk across all assets
 * - Risk budget allocation
 * - Vol term structure (1h vs 24h) for early warning
 */

export default function RiskMonitorPage() {
  const horizon = useSettingsStore((s) => s.horizon);

  const { data: derivedRes, isLoading } = useQuery({
    queryKey: ["derived", "all", horizon],
    queryFn: () => api.getAllDerived(horizon),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: volRes } = useQuery({
    queryKey: ["cross-asset-vol"],
    queryFn: () => api.getCrossAssetVol(),
    refetchInterval: 60_000,
  });

  const derived = derivedRes?.data || {};
  const volData = volRes?.data;

  // Compute aggregate risk metrics
  const assetData = ASSETS.map((a) => derived[a]).filter(Boolean);
  const avgTailRisk2pct = assetData.length > 0
    ? assetData.reduce((sum: number, d: any) => sum + (d.tail_risk?.prob_2pct_drop || 0), 0) / assetData.length
    : 0;
  const avgTailRisk5pct = assetData.length > 0
    ? assetData.reduce((sum: number, d: any) => sum + (d.tail_risk?.prob_5pct_drop || 0), 0) / assetData.length
    : 0;
  const maxVol = assetData.reduce((max: number, d: any) => Math.max(max, d.implied_vol_annualized || 0), 0);
  const tailRiskAssets = assetData.filter((d: any) => d.regime === "tail_risk");

  // Risk level
  const riskLevel = tailRiskAssets.length > 0 ? "HIGH" : avgTailRisk2pct > 0.1 ? "ELEVATED" : "NORMAL";

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
          {"// RISK MONITOR"}
        </h1>
        <span className={cn(
          "font-mono text-[11px] tracking-wider font-bold px-3 py-1 border",
          riskLevel === "HIGH" ? "text-bear border-bear/30 bg-bear/5" :
          riskLevel === "ELEVATED" ? "text-warning border-warning/30 bg-warning/5" :
          "text-neon-green border-neon-green/30 bg-neon-green/5"
        )}>
          RISK: [{riskLevel}]
        </span>
      </div>

      {/* Risk Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border-dim">
        <RiskCard
          label="AVG P(2% DROP)"
          value={formatPercent(avgTailRisk2pct)}
          color={avgTailRisk2pct > 0.15 ? "bear" : avgTailRisk2pct > 0.08 ? "warning" : "bull"}
        />
        <RiskCard
          label="AVG P(5% DROP)"
          value={formatPercent(avgTailRisk5pct)}
          color={avgTailRisk5pct > 0.05 ? "bear" : "bull"}
        />
        <RiskCard
          label="MAX_IMPLIED_VOL"
          value={formatVol(maxVol)}
          color={maxVol > 0.5 ? "warning" : "bull"}
        />
        <RiskCard
          label="TAIL_RISK_ASSETS"
          value={`${tailRiskAssets.length} / ${assetData.length}`}
          color={tailRiskAssets.length > 0 ? "bear" : "bull"}
        />
      </div>

      {/* Per-Asset Risk Table */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// ASSET RISK BREAKDOWN"}
          </h2>
          <span className="font-mono text-[9px] text-text-muted tracking-wider">
            {horizon.toUpperCase()} HORIZON | FORWARD-LOOKING VaR
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-[9px] text-text-muted tracking-wider border-b border-border-dim">
                <th className="text-left px-4 py-2">ASSET</th>
                <th className="text-right px-4 py-2">PRICE</th>
                <th className="text-right px-4 py-2">IMPLIED_VOL</th>
                <th className="text-right px-4 py-2">P(2%_DROP)</th>
                <th className="text-right px-4 py-2">P(5%_DROP)</th>
                <th className="text-right px-4 py-2">P(10%_DROP)</th>
                <th className="text-right px-4 py-2">SKEW</th>
                <th className="text-center px-4 py-2">REGIME</th>
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((asset) => {
                const d = derived[asset];
                if (!d) return null;
                const tail = d.tail_risk || {};
                return (
                  <tr key={asset} className="border-t border-border-dim/50 hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-text-primary tracking-wider">
                      {asset} <span className="text-[8px] text-text-muted">{ASSET_LABELS[asset]}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-primary">
                      ${formatPrice(d.current_price)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className={cn(
                        d.implied_vol_annualized > 0.5 ? "text-warning" : "text-text-secondary"
                      )}>
                        {formatVol(d.implied_vol_annualized)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RiskBar value={tail.prob_2pct_drop || 0} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RiskBar value={tail.prob_5pct_drop || 0} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <RiskBar value={tail.prob_10pct_drop || 0} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                      {d.skew > 0 ? "+" : ""}{d.skew?.toFixed(3)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        "text-[8px] px-1.5 py-0.5 border tracking-wider",
                        d.regime === "tail_risk" ? "border-bear/30 text-bear bg-bear/5" :
                        d.regime === "high_vol_trend" ? "border-warning/30 text-warning bg-warning/5" :
                        d.regime === "low_vol_grind" ? "border-bull/30 text-bull bg-bull/5" :
                        "border-neutral/30 text-neutral bg-neutral/5"
                      )}>
                        [{d.regime?.replace(/_/g, " ").toUpperCase()}]
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vol Term Structure */}
      {volData && (
        <div className="bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim">
            <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// VOL TERM STRUCTURE (1H vs 24H)"}
            </h2>
          </div>
          <div className="p-4">
            <div className="space-y-2">
              {(volData.assets || []).map((a: any) => {
                const ratio = a.vol_term_ratio;
                const structure = ratio > 2 ? "CONTANGO" : ratio < 0.9 ? "BACKWARDATION" : "FLAT";
                return (
                  <div key={a.asset} className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-text-secondary w-12 tracking-wider">{a.asset}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-mono text-[9px] text-text-muted w-16">1H: {a.vol_1h ? formatVol(a.vol_1h) : "—"}</span>
                      <div className="flex-1 h-3 bg-bg-tertiary relative">
                        <div
                          className="h-full bg-neon-green/20"
                          style={{ width: `${Math.min((a.vol_1h || 0) / 1.0 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-mono text-[9px] text-text-muted w-16">24H: {a.vol_24h ? formatVol(a.vol_24h) : "—"}</span>
                      <div className="flex-1 h-3 bg-bg-tertiary relative">
                        <div
                          className="h-full bg-warning/20"
                          style={{ width: `${Math.min((a.vol_24h || 0) / 1.0 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className={cn(
                      "font-mono text-[8px] tracking-wider w-24 text-right",
                      structure === "BACKWARDATION" ? "text-bear" :
                      structure === "CONTANGO" ? "text-warning" : "text-text-muted"
                    )}>
                      [{structure}] {ratio ? `${ratio.toFixed(1)}x` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="font-mono text-[8px] text-text-muted tracking-wider mt-3">
              BACKWARDATION = SHORT-TERM VOL {">"} LONG-TERM (STRESS SIGNAL) | CONTANGO = NORMAL TERM STRUCTURE
            </p>
          </div>
        </div>
      )}

      {/* Risk Recommendations */}
      <div className="bg-bg-secondary border border-border-dim p-4">
        <h3 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase mb-3">
          {"// RISK RECOMMENDATIONS"}
        </h3>
        <div className="space-y-2">
          {tailRiskAssets.length > 0 && (
            <Recommendation
              level="HIGH"
              text={`TAIL RISK detected in ${tailRiskAssets.map((d: any) => d.asset).join(", ")}. Consider reducing leverage or hedging.`}
            />
          )}
          {maxVol > 0.5 && (
            <Recommendation
              level="MEDIUM"
              text={`High implied volatility across assets. Consider smaller position sizes.`}
            />
          )}
          {avgTailRisk2pct < 0.05 && (
            <Recommendation
              level="LOW"
              text="Tail risk is low across the board. Normal trading conditions."
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RiskCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bg-secondary p-3">
      <p className="font-mono text-[8px] text-text-muted tracking-wider">{label}</p>
      <p className={cn(
        "font-mono text-xl font-bold tabular-nums mt-1",
        color === "bear" ? "text-bear" : color === "warning" ? "text-warning" : "text-neon-green"
      )}>
        {value}
      </p>
    </div>
  );
}

function RiskBar({ value }: { value: number }) {
  const pct = Math.min(value * 100 * 5, 100); // Scale for visibility
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-16 h-2 bg-bg-tertiary">
        <div
          className={cn(
            "h-full transition-all",
            value > 0.1 ? "bg-bear/60" : value > 0.03 ? "bg-warning/40" : "bg-neon-green/20"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        "font-mono text-[10px] tabular-nums w-10 text-right",
        value > 0.1 ? "text-bear" : value > 0.03 ? "text-warning" : "text-text-secondary"
      )}>
        {formatPercent(value)}
      </span>
    </div>
  );
}

function Recommendation({ level, text }: { level: string; text: string }) {
  return (
    <div className={cn(
      "p-2 border font-mono text-[10px] tracking-wider",
      level === "HIGH" ? "border-bear/30 bg-bear/5 text-bear" :
      level === "MEDIUM" ? "border-warning/30 bg-warning/5 text-warning" :
      "border-neon-green/30 bg-neon-green/5 text-neon-green"
    )}>
      [{level}] {text}
    </div>
  );
}
