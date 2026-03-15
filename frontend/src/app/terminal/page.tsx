"use client";

import { ScannerTable } from "@/components/scanner-table";
import { VolatilityHeatmap } from "@/components/volatility-heatmap";
import { ProbabilityCone } from "@/components/probability-cone";
import { QuickStats } from "@/components/quick-stats";
import { PortfolioSection } from "@/components/portfolio-section";
import { CrossAssetVol } from "@/components/cross-asset-vol";
import { useSettingsStore } from "@/stores/useSettingsStore";

export default function DashboardPage() {
  const selectedAsset = useSettingsStore((s) => s.selectedAsset);

  return (
    <div className="space-y-4 h-full">
      {/* Quick Stats Row */}
      <QuickStats />

      {/* Scanner Table - Full Width */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// DIRECTIONAL SCANNER"}
          </h2>
          <span className="font-mono text-[9px] text-neon-green tracking-wider">[LIVE]</span>
        </div>
        <ScannerTable />
      </div>

      {/* Cone + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Probability Cone */}
        <div className="lg:col-span-3 bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// PROBABILITY CONE"} —{" "}
              <span className="text-neon-green">{selectedAsset}</span>
            </h2>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">[D3.JS]</span>
          </div>
          <div className="p-4">
            <ProbabilityCone asset={selectedAsset} height={280} />
          </div>
        </div>

        {/* Volatility Heatmap */}
        <div className="lg:col-span-2 bg-bg-secondary border border-border-dim">
          <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
              {"// VOLATILITY HEATMAP"}
            </h2>
            <span className="font-mono text-[9px] text-text-muted tracking-wider">[1H vs 24H]</span>
          </div>
          <div className="p-4">
            <VolatilityHeatmap />
          </div>
        </div>
      </div>

      {/* Cross-Asset Vol Analysis */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// CROSS-ASSET VOLATILITY ANALYSIS"}
          </h2>
          <span className="font-mono text-[9px] text-text-muted tracking-wider">[CRYPTO vs EQUITY vs COMMODITY]</span>
        </div>
        <div className="p-4">
          <CrossAssetVol />
        </div>
      </div>

      {/* Portfolio Section */}
      <PortfolioSection />
    </div>
  );
}
