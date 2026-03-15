"use client";

import { useEffect } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface WalletState {
  address: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const setHlAddress = useSettingsStore((s) => s.setHlAddress);

  // Sync wagmi account state → Zustand store
  useEffect(() => {
    if (isConnected && address) {
      setHlAddress(address);
    }
  }, [isConnected, address, setHlAddress]);

  const connect = () => {
    openConnectModal?.();
  };

  const disconnect = () => {
    wagmiDisconnect();
    setHlAddress("");
  };

  return {
    address: address ?? null,
    isConnecting,
    isConnected,
    error: null,
    connect,
    disconnect,
  };
}
