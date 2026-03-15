"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/useSettingsStore";

export default function LandingPage() {
  const router = useRouter();
  const setSynthApiKey = useSettingsStore((s) => s.setSynthApiKey);
  const setHlAddress = useSettingsStore((s) => s.setHlAddress);
  const existingKey = useSettingsStore((s) => s.synthApiKey);

  const [apiKey, setApiKey] = useState(existingKey);
  const [address, setAddress] = useState("");

  const handleLaunch = () => {
    if (apiKey) setSynthApiKey(apiKey);
    if (address) setHlAddress(address);
    router.push("/terminal");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-lg mx-4">
        {/* Logo */}
        <div className="text-center mb-12">
          <h1 className="font-mono text-4xl font-bold tracking-wider">
            <span className="text-neon-green">SYNTH</span>
            <span className="text-text-primary">EDGE</span>
          </h1>
          <p className="text-text-secondary font-mono text-[11px] mt-2 tracking-widest uppercase">
            PREDICTIVE INTELLIGENCE MEETS ON-CHAIN EXECUTION
          </p>
          <div className="mt-4 h-px bg-border-dim" />
        </div>

        {/* Config Card */}
        <div className="bg-bg-secondary border border-border-dim p-8">
          <div className="mb-4 font-mono text-[10px] text-text-muted tracking-wider">
            {"// INITIALIZE TERMINAL"}
          </div>
          <div className="space-y-6">
            <div>
              <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
                SYNTH_API_KEY
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Synth API key"
                className="w-full bg-bg-tertiary border border-border-dim px-4 py-3 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/30 transition-all"
              />
              <p className="font-mono text-[9px] text-text-muted mt-1 tracking-wider">
                GET YOUR KEY AT{" "}
                <a href="https://dashboard.synthdata.co" target="_blank" rel="noopener noreferrer" className="text-neon-green/70 hover:text-neon-green">
                  DASHBOARD.SYNTHDATA.CO
                </a>
              </p>
            </div>

            <div>
              <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">
                HYPERLIQUID_ADDRESS <span className="text-text-muted">(OPTIONAL)</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-bg-tertiary border border-border-dim px-4 py-3 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/30 transition-all"
              />
              <p className="font-mono text-[9px] text-text-muted mt-1 tracking-wider">
                READ-ONLY PORTFOLIO VIEW. NO PRIVATE KEYS NEEDED.
              </p>
            </div>

            <button
              onClick={handleLaunch}
              className="w-full py-3 bg-neon-green/10 text-neon-green border border-neon-green/30 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-neon-green/20 transition-all duration-200 active:scale-[0.98]"
            >
              [LAUNCH TERMINAL]
            </button>

            <button
              onClick={() => router.push("/terminal")}
              className="w-full py-2 text-text-muted font-mono text-[10px] uppercase tracking-wider hover:text-text-secondary transition-colors"
            >
              SKIP — USE DEMO DATA
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-1 text-center">
          <p className="font-mono text-[9px] text-text-muted tracking-wider">
            NOT FINANCIAL ADVICE. TRADING INVOLVES SUBSTANTIAL RISK OF LOSS.
          </p>
          <p className="font-mono text-[9px] text-text-muted tracking-wider">
            HYPERLIQUID IS NOT AVAILABLE IN USA, UK, OR SANCTIONED COUNTRIES.
          </p>
        </div>
      </div>
    </div>
  );
}
