"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";

interface SettingsState {
  synthApiKey: string;
  hlAddress: string;
  hlApiWalletKey: string; // Persisted HL API wallet private key
  horizon: "1h" | "24h";
  selectedAsset: string;
  sidebarOpen: boolean;
  setSynthApiKey: (key: string) => void;
  setHlAddress: (address: string) => void;
  setHlApiWalletKey: (key: string) => void;
  setHorizon: (h: "1h" | "24h") => void;
  setSelectedAsset: (asset: string) => void;
  toggleSidebar: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      synthApiKey: "",
      hlAddress: "",
      hlApiWalletKey: "",
      horizon: "24h",
      selectedAsset: "BTC",
      sidebarOpen: false,
      setSynthApiKey: (key) => set({ synthApiKey: key }),
      setHlAddress: (address) => set({ hlAddress: address }),
      setHlApiWalletKey: (key) => set({ hlApiWalletKey: key }),
      setHorizon: (h) => set({ horizon: h }),
      setSelectedAsset: (asset) => set({ selectedAsset: asset }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: "synthedge-settings",
      skipHydration: true,
    }
  )
);

export function useHydrateStore() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useSettingsStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  return hydrated;
}
