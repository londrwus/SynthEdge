"use client";

import { useState, useCallback, useEffect } from "react";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface WalletState {
  address: string | null;
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// Track if user intentionally disconnected (survives re-renders, not page reload)
let userDisconnected = false;

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hlAddress = useSettingsStore((s) => s.hlAddress);
  const setHlAddress = useSettingsStore((s) => s.setHlAddress);

  // On mount, only auto-connect if user hasn't disconnected AND hlAddress is set
  useEffect(() => {
    if (userDisconnected) return;
    if (typeof window === "undefined" || !window.ethereum) return;

    const checkConnection = async () => {
      try {
        const accounts = await window.ethereum!.request({
          method: "eth_accounts",
        }) as string[];
        if (accounts.length > 0 && hlAddress) {
          setAddress(accounts[0]);
        }
      } catch {
        // Not connected
      }
    };
    checkConnection();
  }, [hlAddress]);

  // Listen for account changes
  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAddress(null);
        setHlAddress("");
      } else if (!userDisconnected) {
        setAddress(accounts[0]);
        setHlAddress(accounts[0]);
      }
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [setHlAddress]);

  const connect = useCallback(async () => {
    if (typeof window === "undefined") {
      setError("Not in browser");
      return;
    }
    if (!window.ethereum) {
      setError("No wallet detected. Install MetaMask.");
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    setIsConnecting(true);
    setError(null);
    userDisconnected = false;

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      }) as string[];

      if (accounts.length > 0) {
        setAddress(accounts[0]);
        setHlAddress(accounts[0]);
      }
    } catch (err: any) {
      if (err.code === 4001) {
        setError("Connection rejected by user");
      } else {
        setError(err.message || "Failed to connect");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [setHlAddress]);

  const disconnect = useCallback(() => {
    userDisconnected = true;
    setAddress(null);
    setHlAddress("");
    setError(null);
  }, [setHlAddress]);

  return {
    address,
    isConnecting,
    isConnected: !!address,
    error,
    connect,
    disconnect,
  };
}
