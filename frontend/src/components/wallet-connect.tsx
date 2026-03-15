"use client";

import { useWallet } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

export function WalletConnect() {
  const { address, isConnecting, isConnected, error, connect, disconnect } =
    useWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-neon-green tracking-wider">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={disconnect}
          className="font-mono text-[9px] text-text-muted hover:text-bear tracking-wider transition-colors"
        >
          [×]
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className={cn(
        "font-mono text-[10px] tracking-wider transition-colors px-2 py-0.5 border",
        isConnecting
          ? "text-text-muted border-border-dim"
          : "text-neon-green border-neon-green/30 hover:bg-neon-green/10"
      )}
    >
      {isConnecting ? "CONNECTING..." : "[CONNECT WALLET]"}
    </button>
  );
}
