"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { ProbabilityCone } from "@/components/probability-cone";
import { KellyCalculator } from "@/components/kelly-calculator";
import { OptionsView } from "@/components/options-view";
import { DistributionView } from "@/components/distribution-view";
import { PriceChart } from "@/components/price-chart";
import { TradePanel } from "@/components/trade-panel";
import { formatPrice, formatPercent, formatVol, ASSET_LABELS, cn } from "@/lib/utils";

// HL deep link mapping
const HL_ASSET_MAP: Record<string, string> = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  // Equities and commodities may not have direct HL pairs
};

function getHLTradeLink(asset: string): string | null {
  const hlAsset = HL_ASSET_MAP[asset];
  if (!hlAsset) return null;
  return `https://app.hyperliquid.xyz/trade/${hlAsset}`;
}

export default function AssetDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = use(params);
  const horizon = useSettingsStore((s) => s.horizon);

  const { data: derivedRes } = useQuery({
    queryKey: ["derived", symbol, horizon],
    queryFn: () => api.getDerived(symbol, horizon),
    refetchInterval: 10_000,
  });

  // Fetch the other horizon for confluence check
  const otherHorizon = horizon === "1h" ? "24h" : "1h";
  const { data: otherDerivedRes } = useQuery({
    queryKey: ["derived", symbol, otherHorizon],
    queryFn: () => api.getDerived(symbol, otherHorizon),
    refetchInterval: 30_000,
  });

  const derived = derivedRes?.data;
  const otherDerived = otherDerivedRes?.data;

  // Check confluence
  const hasConfluence =
    derived &&
    otherDerived &&
    derived.direction === otherDerived.direction;

  const hlLink = getHLTradeLink(symbol);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-bg-secondary border border-border-dim p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="font-mono text-2xl font-bold text-text-primary tracking-wider">
              {symbol}
            </h1>
            <span className="font-mono text-[11px] text-text-muted tracking-wider uppercase">
              {ASSET_LABELS[symbol] || symbol}
            </span>
            {derived && (
              <>
                <span className="font-sans text-xl tabular-nums text-text-primary font-bold">
                  ${formatPrice(derived.current_price)}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px] font-semibold px-2 py-1 border tracking-wider",
                    derived.direction === "bullish"
                      ? "border-bull/30 text-bull bg-bull/5"
                      : "border-bear/30 text-bear bg-bear/5"
                  )}
                >
                  {derived.direction === "bullish" ? "▲" : "▼"}{" "}
                  {formatPercent(derived.up_probability)} UP
                </span>
                <span className="font-mono text-[10px] px-2 py-1 border border-border-dim text-text-secondary tracking-wider uppercase">
                  {derived.regime?.replace(/_/g, " ")}
                </span>
                {hasConfluence && (
                  <span className="font-mono text-[10px] px-2 py-1 border border-neon-green/30 text-neon-green bg-neon-green/5 tracking-wider uppercase animate-pulse">
                    CONFLUENCE — 1H + 24H {derived.direction?.toUpperCase()}
                  </span>
                )}
              </>
            )}
          </div>

          {/* Trade Links */}
          <div className="flex items-center gap-2">
            {hlLink && (
              <a
                href={hlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-neon-green/10 text-neon-green border border-neon-green/20 font-mono text-[11px] uppercase tracking-wider hover:bg-neon-green/20 transition-all flex items-center gap-2"
              >
                TRADE ON HL
                <span className="text-[9px]">↗</span>
              </a>
            )}
            <button
              onClick={() => window.history.back()}
              className="px-3 py-1.5 bg-bg-tertiary text-text-muted border border-border-dim font-mono text-[11px] uppercase tracking-wider hover:text-text-secondary transition-all"
            >
              BACK
            </button>
          </div>
        </div>
      </div>

      {/* Charts: Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price Forecast */}
        <div className="bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// SYNTH PRICE FORECAST"}
            </h2>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">
              [TRADINGVIEW]
            </span>
          </div>
          <PriceChart asset={symbol} height={340} />
        </div>

        {/* Probability Cone */}
        <div className="bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// PROBABILITY CONE"}
            </h2>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">
              {horizon.toUpperCase()} — HOVER FOR DETAILS
            </span>
          </div>
          <div className="p-4">
            <ProbabilityCone asset={symbol} height={300} />
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Trade Panel */}
        <div className="bg-bg-secondary border border-border-dim p-4">
          <h3 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase mb-4">
            {"// EXECUTE TRADE"}
          </h3>
          <TradePanel
            asset={symbol}
            currentPrice={derived?.current_price}
            upProbability={derived?.up_probability}
            direction={derived?.direction}
          />
        </div>

        {/* Risk Metrics */}
        <div className="bg-bg-secondary border border-border-dim p-4">
          <h3 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase mb-4">
            {"// RISK METRICS"}
          </h3>
          {derived && (
            <div className="space-y-3">
              <MetricRowWithBar label="IMPLIED VOL" value={formatVol(derived.implied_vol_annualized)} pct={Math.min(derived.implied_vol_annualized * 100, 100)} color="neon-green" />
              <MetricRow label="SKEW" value={derived.skew?.toFixed(4)} />
              <MetricRow label="KURTOSIS" value={derived.kurtosis_proxy?.toFixed(2)} />
              <MetricRowWithBar label="CONVICTION" value={formatPercent(derived.conviction)} pct={derived.conviction * 100} color="neon-green" />
              <div className="pt-2 border-t border-border-dim">
                <p className="font-mono text-[10px] text-text-muted tracking-wider mb-2">// TAIL RISK</p>
                <MetricRowWithBar label="P(2% DROP)" value={formatPercent(derived.tail_risk?.prob_2pct_drop || 0)} pct={(derived.tail_risk?.prob_2pct_drop || 0) * 100} color="bear" />
                <MetricRowWithBar label="P(5% DROP)" value={formatPercent(derived.tail_risk?.prob_5pct_drop || 0)} pct={(derived.tail_risk?.prob_5pct_drop || 0) * 100} color="bear" />
                <MetricRowWithBar label="P(10% DROP)" value={formatPercent(derived.tail_risk?.prob_10pct_drop || 0)} pct={(derived.tail_risk?.prob_10pct_drop || 0) * 100} color="bear" />
              </div>
            </div>
          )}
          {!derived && <LoadingPulse />}
        </div>

        {/* Kelly Calculator */}
        <div className="bg-bg-secondary border border-border-dim p-4">
          <h3 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase mb-4">
            {"// KELLY POSITION SIZER"}
          </h3>
          <KellyCalculator asset={symbol} currentPrice={derived?.current_price} />
        </div>

        {/* Regime + Direction */}
        <div className="bg-bg-secondary border border-border-dim p-4">
          <h3 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase mb-4">
            {"// REGIME ANALYSIS"}
          </h3>
          {derived && (
            <div className="space-y-4">
              <div className={cn(
                "p-3 border",
                derived.regime === "tail_risk" ? "bg-bear/5 border-bear/20" :
                derived.regime === "high_vol_trend" ? "bg-warning/5 border-warning/20" :
                derived.regime === "low_vol_grind" ? "bg-bull/5 border-bull/20" :
                "bg-neutral/5 border-neutral/20"
              )}>
                <p className="font-mono text-[11px] font-bold text-text-primary tracking-wider">
                  [{derived.regime?.replace(/_/g, " ").toUpperCase()}]
                </p>
                <p className="font-mono text-[10px] text-text-secondary mt-1">
                  {derived.regime_description}
                </p>
              </div>

              <MetricRow label="DIRECTION" value={`[${derived.direction?.toUpperCase()}]`} color={derived.direction === "bullish" ? "bull" : "bear"} />
              <MetricRowWithBar label="UP PROBABILITY" value={formatPercent(derived.up_probability)} pct={derived.up_probability * 100} color={derived.up_probability > 0.5 ? "bull" : "bear"} />
              <MetricRow label="MEDIAN FORECAST" value={`$${formatPrice(derived.median_forecast)}`} />
              <MetricRow label="VOL RANGE" value={`[${derived.regime === "tail_risk" ? "WIDE" : derived.regime === "low_vol_grind" ? "TIGHT" : "MODERATE"}]`} />

              {/* Confluence Section */}
              <div className="pt-2 border-t border-border-dim">
                <p className="font-mono text-[10px] text-text-muted tracking-wider mb-2">// TIMEFRAME CONFLUENCE</p>
                {hasConfluence ? (
                  <div className="p-2 border border-neon-green/30 bg-neon-green/5">
                    <p className="font-mono text-[10px] text-neon-green tracking-wider">
                      1H + 24H AGREE: [{derived.direction?.toUpperCase()}]
                    </p>
                    <p className="font-mono text-[9px] text-text-muted mt-1">
                      HIGHER CONVICTION SIGNAL
                    </p>
                  </div>
                ) : otherDerived ? (
                  <div className="p-2 border border-warning/30 bg-warning/5">
                    <p className="font-mono text-[10px] text-warning tracking-wider">
                      DIVERGENCE DETECTED
                    </p>
                    <p className="font-mono text-[9px] text-text-muted mt-1">
                      {horizon.toUpperCase()}: [{derived.direction?.toUpperCase()}] vs {otherHorizon.toUpperCase()}: [{otherDerived.direction?.toUpperCase()}]
                    </p>
                  </div>
                ) : (
                  <div className="p-2 border border-border-dim">
                    <p className="font-mono text-[10px] text-text-muted tracking-wider">
                      LOADING OTHER HORIZON...
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {!derived && <LoadingPulse />}
        </div>
      </div>

      {/* VaR & Volatility Metrics */}
      {derived && (
        <div className="bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
            <h3 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// VALUE AT RISK & VOLATILITY"}
            </h3>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">[FORWARD-LOOKING FROM SYNTH]</span>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-border-dim">
            <VarMetric
              label="VAR 95%"
              value={`${((1 - (derived.tail_risk?.prob_5pct_drop > 0.05 ? 5 : 2)) > 0 ? "-" : "")}${(derived.tail_risk?.prob_2pct_drop * 100 * 2.5).toFixed(1)}%`}
              sub="24H MAX LOSS (95% CI)"
              color={derived.tail_risk?.prob_2pct_drop > 0.1 ? "bear" : "text"}
            />
            <VarMetric
              label="CVAR 99%"
              value={`-${(derived.tail_risk?.prob_5pct_drop * 100 * 3).toFixed(1)}%`}
              sub="EXPECTED SHORTFALL"
              color="bear"
            />
            <VarMetric
              label="IMPLIED VOL"
              value={`${(derived.implied_vol_annualized * 100).toFixed(1)}%`}
              sub="ANNUALIZED"
              color="neon"
            />
            <VarMetric
              label="DAILY VOL"
              value={`${(derived.implied_vol_annualized / Math.sqrt(252) * 100).toFixed(2)}%`}
              sub="= ANN / SQRT(252)"
              color="text"
            />
            <VarMetric
              label="SHARPE PROXY"
              value={`${((derived.up_probability - 0.5) * 10 / Math.max(derived.implied_vol_annualized, 0.01)).toFixed(2)}`}
              sub="DIRECTIONAL EDGE / VOL"
              color={derived.up_probability > 0.5 ? "bull" : "bear"}
            />
          </div>
        </div>
      )}

      {/* Quant Row: Options + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Options Chain */}
        <div className="bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
            <h3 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// SYNTH OPTIONS PRICING"}
            </h3>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">[MONTE CARLO]</span>
          </div>
          <div className="p-4">
            <OptionsView asset={symbol} />
          </div>
        </div>

        {/* Distribution Analysis */}
        <div className="bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
            <h3 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// DISTRIBUTION ANALYSIS"}
            </h3>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">[PERCENTILES]</span>
          </div>
          <div className="p-4">
            <DistributionView asset={symbol} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string | undefined; color?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="font-mono text-[10px] text-text-muted tracking-wider">{label}</span>
      <span className={cn(
        "font-mono text-[11px] tabular-nums font-medium tracking-wider",
        color === "bull" ? "text-bull" : color === "bear" ? "text-bear" : "text-text-primary"
      )}>
        {value || "\u2014"}
      </span>
    </div>
  );
}

function MetricRowWithBar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: string | undefined;
  pct: number;
  color: string;
}) {
  const barColor =
    color === "bull" || color === "neon-green"
      ? "bg-neon-green/40"
      : color === "bear"
      ? "bg-bear/40"
      : "bg-text-secondary/40";

  return (
    <div className="space-y-1 py-0.5">
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] text-text-muted tracking-wider">{label}</span>
        <span className={cn(
          "font-mono text-[11px] tabular-nums font-medium tracking-wider",
          color === "bull" || color === "neon-green" ? "text-neon-green" : color === "bear" ? "text-bear" : "text-text-primary"
        )}>
          {value || "\u2014"}
        </span>
      </div>
      <div className="h-1 bg-bg-tertiary w-full">
        <div
          className={cn("h-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

function VarMetric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-bg-secondary p-3 text-center">
      <p className="font-mono text-[8px] text-text-muted tracking-wider">{label}</p>
      <p className={cn(
        "font-mono text-[16px] font-bold tabular-nums mt-1",
        color === "bear" ? "text-bear" : color === "bull" ? "text-bull" : color === "neon" ? "text-neon-green" : "text-text-primary"
      )}>
        {value}
      </p>
      <p className="font-mono text-[7px] text-text-muted tracking-wider mt-1">{sub}</p>
    </div>
  );
}

function LoadingPulse() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-4 bg-neon-green/5 animate-pulse" />
      ))}
    </div>
  );
}
