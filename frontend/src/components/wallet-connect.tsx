"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
        const connected = mounted && account && chain;

        return (
          <div
            {...(!mounted && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none" as const, userSelect: "none" as const },
            })}
          >
            {connected ? (
              <button
                onClick={openAccountModal}
                className="flex items-center gap-2 font-mono text-[10px] tracking-wider transition-colors"
              >
                <span className="text-neon-green">
                  {account.displayName}
                </span>
                <span className="text-text-muted hover:text-bear text-[9px]">[×]</span>
              </button>
            ) : (
              <button
                onClick={openConnectModal}
                className="font-mono text-[10px] tracking-wider transition-colors px-2 py-0.5 border text-neon-green border-neon-green/30 hover:bg-neon-green/10"
              >
                [CONNECT WALLET]
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
