"use client";

import { useSettingsStore } from "@/stores/useSettingsStore";

export default function SettingsPage() {
  const {
    synthApiKey,
    hlAddress,
    horizon,
    setSynthApiKey,
    setHlAddress,
    setHorizon,
  } = useSettingsStore();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-text-primary tracking-wider uppercase">
          {"// SETTINGS"}
        </h1>
        <span className="font-mono text-[9px] text-neon-green tracking-wider">[CONFIG]</span>
      </div>

      {/* API Configuration */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// API CONFIGURATION"}
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
              SYNTH_API_KEY
            </label>
            <input
              type="password"
              value={synthApiKey}
              onChange={(e) => setSynthApiKey(e.target.value)}
              placeholder="Enter your Synth API key"
              className="w-full bg-bg-tertiary border border-border-dim px-4 py-2.5 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/30 transition-all"
            />
            <p className="font-mono text-[9px] text-text-muted tracking-wider mt-1">
              GET YOUR KEY AT{" "}
              <a
                href="https://dashboard.synthdata.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neon-green/70 hover:text-neon-green"
              >
                DASHBOARD.SYNTHDATA.CO
              </a>
            </p>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
              HYPERLIQUID_ADDRESS
            </label>
            <input
              type="text"
              value={hlAddress}
              onChange={(e) => setHlAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-bg-tertiary border border-border-dim px-4 py-2.5 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/30 transition-all"
            />
            <p className="font-mono text-[9px] text-text-muted tracking-wider mt-1">
              READ-ONLY PORTFOLIO VIEW. NO PRIVATE KEYS NEEDED.
            </p>
          </div>
        </div>
      </div>

      {/* Display Preferences */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// DISPLAY PREFERENCES"}
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
              DEFAULT_HORIZON
            </label>
            <div className="flex border border-border-dim w-fit">
              <button
                onClick={() => setHorizon("1h")}
                className={`px-4 py-2 font-mono text-[11px] tracking-wider transition-all ${
                  horizon === "1h"
                    ? "bg-neon-green/15 text-neon-green"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                }`}
              >
                1H
              </button>
              <button
                onClick={() => setHorizon("24h")}
                className={`px-4 py-2 font-mono text-[11px] tracking-wider transition-all border-l border-border-dim ${
                  horizon === "24h"
                    ? "bg-neon-green/15 text-neon-green"
                    : "bg-bg-tertiary text-text-muted hover:text-text-secondary"
                }`}
              >
                24H
              </button>
            </div>
            <p className="font-mono text-[9px] text-text-muted tracking-wider mt-1">
              1H = 61 TIMESTEPS (1MIN) | 24H = 289 TIMESTEPS (5MIN)
            </p>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
              POLLING_INTERVAL
            </label>
            <div className="font-mono text-[11px] text-text-secondary bg-bg-tertiary border border-border-dim px-4 py-2.5">
              10 SECONDS <span className="text-text-muted">[FIXED]</span>
            </div>
          </div>

          <div>
            <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
              ASSETS
            </label>
            <div className="flex flex-wrap gap-2">
              {["BTC", "ETH", "SOL", "XAU", "SPY", "NVDA", "TSLA", "AAPL", "GOOGL"].map(
                (asset) => (
                  <span
                    key={asset}
                    className="font-mono text-[10px] px-2 py-1 border border-border-dim text-text-secondary tracking-wider"
                  >
                    {asset}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* About / Disclaimers */}
      <div className="bg-bg-secondary border border-border-dim">
        <div className="px-4 py-3 border-b border-border-dim">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// ABOUT"}
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between font-mono text-[11px] tracking-wider">
            <span className="text-text-muted">APPLICATION</span>
            <span className="text-text-primary">SYNTHEDGE v0.1.0</span>
          </div>
          <div className="flex justify-between font-mono text-[11px] tracking-wider">
            <span className="text-text-muted">CATEGORY</span>
            <span className="text-text-primary">BEST EQUITIES APPLICATION</span>
          </div>
          <div className="flex justify-between font-mono text-[11px] tracking-wider">
            <span className="text-text-muted">DATA_SOURCE</span>
            <span className="text-neon-green">SYNTH API</span>
          </div>
          <div className="flex justify-between font-mono text-[11px] tracking-wider">
            <span className="text-text-muted">EXECUTION</span>
            <span className="text-text-primary">HYPERLIQUID (READ-ONLY)</span>
          </div>

          <div className="pt-3 border-t border-border-dim space-y-2">
            <p className="font-mono text-[10px] text-text-muted tracking-wider">
              // DISCLAIMER
            </p>
            <p className="font-mono text-[10px] text-text-muted leading-relaxed">
              NOT FINANCIAL ADVICE. TRADING INVOLVES SUBSTANTIAL RISK OF LOSS.
              THIS APPLICATION PROVIDES PROBABILISTIC FORECASTS DERIVED FROM
              SYNTH API DATA AND DOES NOT GUARANTEE FUTURE PERFORMANCE.
            </p>
            <p className="font-mono text-[10px] text-text-muted leading-relaxed">
              HYPERLIQUID IS NOT AVAILABLE IN USA, UK, OR SANCTIONED COUNTRIES.
              USERS ARE RESPONSIBLE FOR COMPLIANCE WITH LOCAL REGULATIONS.
            </p>
          </div>

          <div className="pt-3 border-t border-border-dim space-y-2">
            <p className="font-mono text-[10px] text-text-muted tracking-wider">
              // DATA SECURITY
            </p>
            <p className="font-mono text-[10px] text-text-muted leading-relaxed">
              YOUR API KEY IS STORED LOCALLY IN YOUR BROWSER (LOCALSTORAGE).
              IT IS NEVER SENT TO OUR SERVERS. YOUR HYPERLIQUID ADDRESS IS
              USED FOR READ-ONLY POSITION VIEWING ONLY.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
