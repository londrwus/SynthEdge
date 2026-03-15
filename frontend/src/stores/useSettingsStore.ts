"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";

interface SettingsState {
  synthApiKey: string;
  hlAddress: string;
  horizon: "1h" | "24h";
  selectedAsset: string;
  sidebarOpen: boolean;
  setSynthApiKey: (key: string) => void;
  setHlAddress: (address: string) => void;
  setHorizon: (h: "1h" | "24h") => void;
  setSelectedAsset: (asset: string) => void;
  toggleSidebar: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      synthApiKey: "",
      hlAddress: "",
      horizon: "24h",
      selectedAsset: "BTC",
      sidebarOpen: false,
      setSynthApiKey: (key) => set({ synthApiKey: key }),
      setHlAddress: (address) => set({ hlAddress: address }),
      setHorizon: (h) => set({ horizon: h }),
      setSelectedAsset: (asset) => set({ selectedAsset: asset }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: "synthedge-settings",
      // Skip hydration on server to avoid SSR mismatch
      skipHydration: true,
    }
  )
);

/**
 * Hook to safely hydrate Zustand persist store on the client.
 * Call this once in the root Providers component.
 */
export function useHydrateStore() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useSettingsStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  return hydrated;
}
