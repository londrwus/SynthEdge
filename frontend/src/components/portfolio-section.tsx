"use client";

import { useState } from "react";
import { usePortfolio } from "@/hooks/useSynth";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { formatPrice, cn } from "@/lib/utils";

export function PortfolioSection() {
  const hlAddress = useSettingsStore((s) => s.hlAddress);
  const setHlAddress = useSettingsStore((s) => s.setHlAddress);
  const { data, isLoading, error } = usePortfolio();
  const [inputAddress, setInputAddress] = useState("");

  const handleConnect = () => {
    const addr = inputAddress.trim();
    if (addr && addr.startsWith("0x") && addr.length >= 10) {
      setHlAddress(addr);
    }
  };

  const handleDisconnect = () => {
    setHlAddress("");
    setInputAddress("");
  };

  if (!hlAddress) {
    return (
      <div className="border border-border-dim bg-bg-secondary">
        <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
          <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
            {"// PORTFOLIO"}
          </h2>
          <span className="font-mono text-[9px] text-text-muted">[DISCONNECTED]</span>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          <div className="font-mono text-[11px] text-text-muted text-center tracking-wider">
            CONNECT HYPERLIQUID ADDRESS TO VIEW POSITIONS
          </div>
          <div className="flex gap-2 w-full max-w-md">
            <input
              type="text"
              value={inputAddress}
              placeholder="0x..."
              onChange={(e) => setInputAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              className="flex-1 bg-bg-tertiary border border-border-dim px-3 py-2 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/30 transition-all"
            />
            <button
              onClick={handleConnect}
              disabled={!inputAddress.trim()}
              className="px-4 py-2 bg-neon-green/10 text-neon-green border border-neon-green/20 font-mono text-[10px] uppercase tracking-wider hover:bg-neon-green/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              CONNECT
            </button>
          </div>
          <p className="font-mono text-[9px] text-text-muted tracking-wider">
            READ-ONLY. NO PRIVATE KEYS REQUIRED.
          </p>
        </div>
      </div>
    );
  }

  const positions = data?.data?.positions || [];
  const margin = data?.data?.margin_summary;

  return (
    <div className="border border-border-dim bg-bg-secondary">
      <div className="px-4 py-3 border-b border-border-dim flex items-center justify-between">
        <h2 className="font-mono text-[11px] tracking-wider text-text-secondary uppercase">
          {"// PORTFOLIO"}
        </h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-text-muted tracking-wider">
            {hlAddress.slice(0, 6)}...{hlAddress.slice(-4)}
          </span>
          <span className="font-mono text-[9px] text-neon-green">[CONNECTED]</span>
          <button
            onClick={handleDisconnect}
            className="font-mono text-[9px] text-text-muted hover:text-bear tracking-wider transition-colors"
          >
            [DISCONNECT]
          </button>
        </div>
      </div>

      {/* Margin Summary */}
      {margin && (
        <div className="grid grid-cols-3 gap-px bg-border-dim border-b border-border-dim">
          <div className="bg-bg-secondary p-2.5 text-center">
            <p className="font-mono text-[8px] text-text-muted tracking-wider">ACCOUNT_VALUE</p>
            <p className="font-mono text-[13px] text-text-primary font-semibold tabular-nums">
              ${formatPrice(margin.account_value || 0)}
            </p>
          </div>
          <div className="bg-bg-secondary p-2.5 text-center">
            <p className="font-mono text-[8px] text-text-muted tracking-wider">MARGIN_USED</p>
            <p className="font-mono text-[13px] text-text-primary font-semibold tabular-nums">
              ${formatPrice(margin.total_margin_used || 0)}
            </p>
          </div>
          <div className="bg-bg-secondary p-2.5 text-center">
            <p className="font-mono text-[8px] text-text-muted tracking-wider">POSITIONS</p>
            <p className="font-mono text-[13px] text-text-primary font-semibold tabular-nums">
              {positions.length}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="p-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 bg-neon-green/5 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 text-center font-mono text-[11px] text-bear tracking-wider">
          ERROR LOADING POSITIONS. CHECK ADDRESS.
        </div>
      ) : positions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-[10px] text-text-muted uppercase tracking-wider border-b border-border-dim">
                <th className="text-left px-4 py-2">ASSET</th>
                <th className="text-center px-4 py-2">SIDE</th>
                <th className="text-right px-4 py-2">SIZE</th>
                <th className="text-right px-4 py-2">ENTRY</th>
                <th className="text-right px-4 py-2">LEVERAGE</th>
                <th className="text-right px-4 py-2">UNREALIZED_PNL</th>
                <th className="text-right px-4 py-2">SYNTH_DIRECTION</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos: any, idx: number) => {
                const pnl = Number(pos.unrealized_pnl) || 0;
                const size = Number(pos.size) || 0;
                const synth = pos.synth || {};
                return (
                  <tr key={`${pos.asset}-${idx}`} className="border-t border-border-dim hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-text-primary tracking-wider">
                      {pos.asset}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 border tracking-wider",
                        pos.direction === "long"
                          ? "border-bull/30 text-bull bg-bull/5"
                          : "border-bear/30 text-bear bg-bear/5"
                      )}>
                        [{(pos.direction || "LONG").toUpperCase()}]
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-primary">
                      {size.toFixed(4)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                      ${formatPrice(Number(pos.entry_price) || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-text-secondary">
                      {Number(pos.leverage || 1).toFixed(1)}x
                    </td>
                    <td className={cn(
                      "px-4 py-2.5 text-right tabular-nums font-semibold",
                      pnl >= 0 ? "text-bull" : "text-bear"
                    )}>
                      {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {synth.direction ? (
                        <span className={cn(
                          "text-[9px] tracking-wider",
                          synth.direction === "bullish" ? "text-bull" : "text-bear"
                        )}>
                          [{synth.direction.toUpperCase()}] {synth.up_probability ? `${(synth.up_probability * 100).toFixed(0)}%` : ""}
                        </span>
                      ) : (
                        <span className="text-[9px] text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 text-center font-mono text-[11px] text-text-muted tracking-wider">
          NO OPEN POSITIONS ON HYPERLIQUID
        </div>
      )}
    </div>
  );
}
