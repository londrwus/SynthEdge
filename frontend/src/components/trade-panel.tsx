"use client";

import { useState, useCallback } from "react";
import { formatPrice, cn } from "@/lib/utils";
import { useWallet } from "@/hooks/useWallet";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { api } from "@/lib/api";

interface TradePanelProps {
  asset: string;
  currentPrice?: number;
  upProbability?: number;
  direction?: string;
}

// All assets tradeable on HL (crypto = native perps, equities = HIP-3 spot)
const HL_TRADEABLE = new Set(["BTC", "ETH", "SOL", "XAU", "TSLA", "AAPL", "GOOGL", "SPY"]);
const EQUITY_ASSETS = new Set(["TSLA", "AAPL", "GOOGL", "SPY"]);

// Minimum notional and max leverage per asset
const MIN_NOTIONAL = 10;
const MAX_LEVERAGE: Record<string, number> = {
  BTC: 50, ETH: 50, SOL: 20, XAU: 20,
  SPY: 10, TSLA: 5, AAPL: 5, GOOGL: 5,
};

interface TradeResult {
  status: string;
  fill_price?: string;
  filled_size?: string;
  notional?: number;
  margin_used?: number;
  order_id?: number;
  synth_tp?: number;
  synth_sl?: number;
}

export function TradePanel({ asset, currentPrice, upProbability, direction }: TradePanelProps) {
  const isTradeable = HL_TRADEABLE.has(asset);
  const isEquity = EQUITY_ASSETS.has(asset);
  const { address, isConnected, connect } = useWallet();
  const storedApiKey = useSettingsStore((s) => s.hlApiWalletKey);
  const setStoredApiKey = useSettingsStore((s) => s.setHlApiWalletKey);
  const [isBuy, setIsBuy] = useState(direction === "bullish");
  const [size, setSize] = useState("0.001");
  const maxLev = MAX_LEVERAGE[asset] || 20;
  const [leverage, setLeverage] = useState(Math.min(5, maxLev));
  const [mode, setMode] = useState<"smart" | "market">("smart");
  const [apiKey, setApiKey] = useState(storedApiKey);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sizeNum = parseFloat(size) || 0;
  const notional = sizeNum * (currentPrice || 0);
  const margin = notional / leverage;
  const isBelowMin = currentPrice ? notional < MIN_NOTIONAL : false;

  // Validate API key format
  const isKeyValid = apiKey.startsWith("0x") && apiKey.length === 66;

  const handleTrade = useCallback(async () => {
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    if (!isKeyValid) {
      setError("Invalid API key format. Must be 0x-prefixed, 64 hex characters. Create one at app.hyperliquid.xyz → Settings → API Wallet.");
      return;
    }

    // Pre-flight checks
    if (sizeNum <= 0) {
      setError("Size must be greater than 0.");
      return;
    }

    if (isBelowMin) {
      setError(`Order too small. Notional $${notional.toFixed(2)} is below Hyperliquid minimum of $${MIN_NOTIONAL}. Increase your size.`);
      return;
    }

    // Persist the API key for future use
    if (apiKey !== storedApiKey) {
      setStoredApiKey(apiKey);
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const body = {
        asset,
        is_buy: isBuy,
        size: sizeNum,
        leverage,
        private_key: apiKey,
        account_address: address || undefined,
      };

      const res = await (mode === "smart"
        ? api.placeSmartOrder(body)
        : api.placeMarketOrder(body));

      setResult(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Trade failed";
      setError(msg);
    } finally {
      setIsExecuting(false);
    }
  }, [asset, isBuy, size, sizeNum, mode, apiKey, leverage, address, notional, isBelowMin, isKeyValid, storedApiKey, setStoredApiKey]);

  return (
    <div className="space-y-3">
      {/* HIP-3 equity note */}
      {isEquity && (
        <div className="p-2 border border-border-dim bg-bg-tertiary">
          <p className="font-mono text-[8px] text-text-muted tracking-wider">
            {"// HIP-3 EQUITY PERP \u2014 TRADES VIA HYPERLIQUID SPOT MARKET"}
          </p>
        </div>
      )}

      {/* Synth Signal */}
      {upProbability !== undefined && (
        <div className={cn(
          "p-2 border text-center",
          (upProbability > 0.55) ? "border-bull/30 bg-bull/5" :
          (upProbability < 0.45) ? "border-bear/30 bg-bear/5" :
          "border-border-dim bg-bg-tertiary"
        )}>
          <p className="font-mono text-[9px] text-text-muted tracking-wider">SYNTH SIGNAL</p>
          <p className={cn(
            "font-mono text-[13px] font-bold tracking-wider",
            (upProbability > 0.55) ? "text-bull" :
            (upProbability < 0.45) ? "text-bear" : "text-neutral"
          )}>
            {direction?.toUpperCase()} {"\u2014"} {(upProbability * 100).toFixed(1)}% UP
          </p>
        </div>
      )}

      {/* Trading form */}
      {!isTradeable ? null : !isConnected ? (
        <button
          onClick={() => connect()}
          className="w-full py-2.5 font-mono text-[11px] font-bold tracking-widest transition-all border border-neon-green/30 text-neon-green hover:bg-neon-green/10"
        >
          [CONNECT WALLET]
        </button>
      ) : (
        <div className="p-2 border border-neon-green/20 bg-neon-green/5 flex items-center justify-between">
          <div>
            <p className="font-mono text-[8px] text-text-muted tracking-wider">WALLET</p>
            <p className="font-mono text-[10px] text-neon-green tracking-wider">
              {address?.slice(0, 8)}...{address?.slice(-6)}
            </p>
          </div>
          <span className="font-mono text-[8px] text-neon-green tracking-wider">[CONNECTED]</span>
        </div>
      )}

      {/* Order Mode */}
      <div className="flex border border-border-dim">
        <button
          onClick={() => setMode("smart")}
          className={cn(
            "flex-1 py-1.5 font-mono text-[9px] tracking-wider transition-all",
            mode === "smart" ? "bg-neon-green/15 text-neon-green" : "text-text-muted bg-bg-tertiary"
          )}
        >
          SMART ORDER
        </button>
        <button
          onClick={() => setMode("market")}
          className={cn(
            "flex-1 py-1.5 font-mono text-[9px] tracking-wider transition-all border-l border-border-dim",
            mode === "market" ? "bg-neon-green/15 text-neon-green" : "text-text-muted bg-bg-tertiary"
          )}
        >
          MARKET
        </button>
      </div>

      {/* Direction */}
      <div className="flex border border-border-dim">
        <button
          onClick={() => setIsBuy(true)}
          className={cn(
            "flex-1 py-2 font-mono text-[11px] font-bold tracking-wider transition-all",
            isBuy ? "bg-bull/15 text-bull" : "text-text-muted bg-bg-tertiary"
          )}
        >
          LONG
        </button>
        <button
          onClick={() => setIsBuy(false)}
          className={cn(
            "flex-1 py-2 font-mono text-[11px] font-bold tracking-wider transition-all border-l border-border-dim",
            !isBuy ? "bg-bear/15 text-bear" : "text-text-muted bg-bg-tertiary"
          )}
        >
          SHORT
        </button>
      </div>

      {/* Size */}
      <div>
        <label className="block font-mono text-[9px] text-text-muted tracking-wider mb-1">SIZE ({asset})</label>
        <input
          type="number"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          step="0.001"
          min="0.001"
          className={cn(
            "w-full bg-bg-tertiary border px-3 py-2 font-mono text-[11px] text-text-primary tabular-nums focus:outline-none transition-all",
            isBelowMin ? "border-bear/50 focus:border-bear/70" : "border-border-dim focus:border-neon-green/30"
          )}
        />
        {currentPrice && (
          <div className="mt-1 space-y-0.5">
            <p className={cn(
              "font-mono text-[9px] tracking-wider",
              isBelowMin ? "text-bear" : "text-text-muted"
            )}>
              {isBelowMin ? `\u26A0 ` : "\u2248 "}
              ${formatPrice(notional)} NOTIONAL
              {isBelowMin ? ` \u2014 BELOW $${MIN_NOTIONAL} MINIMUM` : ""}
              {" | MARGIN: $"}{formatPrice(margin)}
            </p>
          </div>
        )}
      </div>

      {/* Leverage */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="font-mono text-[9px] text-text-muted tracking-wider">LEVERAGE</label>
          <span className="font-mono text-[11px] text-neon-green font-bold tracking-wider">{leverage}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={maxLev}
          step={1}
          value={leverage}
          onChange={(e) => setLeverage(parseInt(e.target.value))}
          className="w-full h-1 bg-bg-tertiary appearance-none cursor-pointer accent-[#f5f8c2]"
        />
        <div className="flex justify-between font-mono text-[8px] text-text-muted tracking-wider mt-1">
          <span>1x</span>
          {maxLev > 5 && <span>5x</span>}
          {maxLev > 10 && <span>10x</span>}
          {maxLev > 20 && <span>20x</span>}
          <span>{maxLev}x</span>
        </div>
      </div>

      {/* Smart Order Info */}
      {mode === "smart" && (
        <div className="p-2 border border-border-dim bg-bg-tertiary">
          <p className="font-mono text-[8px] text-neon-green/60 tracking-wider mb-1">{"// SYNTH-POWERED LEVELS"}</p>
          <p className="font-mono text-[9px] text-text-secondary tracking-wider">
            TP {"\u2192"} {isBuy ? "P80" : "P20"} PERCENTILE
          </p>
          <p className="font-mono text-[9px] text-text-secondary tracking-wider">
            SL {"\u2192"} {isBuy ? "P20" : "P80"} PERCENTILE
          </p>
        </div>
      )}

      {/* API Wallet Key */}
      {showKeyInput && !apiKey && (
        <div>
          <label className="block font-mono text-[9px] text-text-muted tracking-wider mb-1">
            HL API WALLET KEY
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Hyperliquid API wallet private key"
            className="w-full bg-bg-tertiary border border-border-dim px-3 py-2 font-mono text-[10px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/30 transition-all"
          />
          <p className="font-mono text-[8px] text-text-muted tracking-wider mt-1">
            CREATE AN API WALLET AT APP.HYPERLIQUID.XYZ {"\u2192"} SETTINGS.
            KEY IS USED FOR THIS SESSION ONLY.
          </p>
        </div>
      )}

      {/* Execute */}
      <button
        onClick={handleTrade}
        disabled={isExecuting || !size || sizeNum <= 0 || isBelowMin}
        className={cn(
          "w-full py-2.5 font-mono text-[11px] font-bold tracking-widest transition-all border",
          isBuy
            ? "bg-bull/10 text-bull border-bull/30 hover:bg-bull/20"
            : "bg-bear/10 text-bear border-bear/30 hover:bg-bear/20",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
      >
        {isExecuting ? "EXECUTING..." : showKeyInput && !apiKey ? "[ENTER API KEY ABOVE]" : `[${isBuy ? "LONG" : "SHORT"} ${asset}]`}
      </button>

      {/* Success Result */}
      {result && (
        <div className="p-2 border border-neon-green/30 bg-neon-green/5 space-y-1">
          <p className="font-mono text-[10px] text-neon-green tracking-wider font-bold">
            {result.status?.toUpperCase() || "SUBMITTED"}
          </p>
          {result.fill_price && (
            <p className="font-mono text-[9px] text-text-secondary tracking-wider">
              FILL: ${result.fill_price}
              {result.filled_size ? ` | SIZE: ${result.filled_size}` : ""}
            </p>
          )}
          {result.notional && (
            <p className="font-mono text-[9px] text-text-secondary tracking-wider">
              NOTIONAL: ${formatPrice(result.notional)}
              {result.margin_used ? ` | MARGIN: $${formatPrice(result.margin_used)}` : ""}
            </p>
          )}
          {result.synth_tp && (
            <p className="font-mono text-[9px] text-text-secondary tracking-wider">
              TP: ${formatPrice(result.synth_tp)} | SL: ${formatPrice(result.synth_sl || 0)}
            </p>
          )}
          {result.order_id && (
            <p className="font-mono text-[8px] text-text-muted tracking-wider">
              ORDER #{result.order_id}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 border border-bear/30 bg-bear/5">
          <p className="font-mono text-[9px] text-bear tracking-wider">{error}</p>
        </div>
      )}

      <p className="font-mono text-[7px] text-text-muted tracking-wider text-center leading-relaxed">
        TRADES EXECUTE ON HYPERLIQUID L1 VIA API WALLET.
        NOT AVAILABLE IN USA/UK. NOT FINANCIAL ADVICE.
      </p>
    </div>
  );
}
