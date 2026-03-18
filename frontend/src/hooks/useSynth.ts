"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettingsStore, useHydrateStore } from "@/stores/useSettingsStore";

/**
 * All hooks use placeholderData: keepPreviousData to prevent
 * the UI from flickering/emptying when refetching.
 * staleTime prevents unnecessary re-renders when data hasn't changed.
 *
 * synthApiKey is included in query keys so queries automatically
 * re-run when the key changes (e.g. after store hydration or
 * when the user enters a key in Settings).
 */

function useApiKeyTag() {
  const key = useSettingsStore((s) => s.synthApiKey);
  return key ? "withKey" : "noKey";
}

export function useScanner() {
  const horizon = useSettingsStore((s) => s.horizon);
  const keyTag = useApiKeyTag();
  const hydrated = useHydrateStore();
  return useQuery({
    queryKey: ["scanner", horizon, keyTag],
    queryFn: () => api.getScanner(horizon),
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled: hydrated,
    placeholderData: keepPreviousData,
  });
}

export function useAllDerived() {
  const horizon = useSettingsStore((s) => s.horizon);
  const keyTag = useApiKeyTag();
  const hydrated = useHydrateStore();
  return useQuery({
    queryKey: ["derived", "all", horizon, keyTag],
    queryFn: () => api.getAllDerived(horizon),
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled: hydrated,
    placeholderData: keepPreviousData,
  });
}

export function usePercentiles(asset: string) {
  const horizon = useSettingsStore((s) => s.horizon);
  const keyTag = useApiKeyTag();
  const hydrated = useHydrateStore();
  return useQuery({
    queryKey: ["percentiles", asset, horizon, keyTag],
    queryFn: () => api.getPercentiles(asset, horizon),
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled: hydrated && !!asset,
    placeholderData: keepPreviousData,
  });
}

export function usePortfolio() {
  const hlAddress = useSettingsStore((s) => s.hlAddress);
  const horizon = useSettingsStore((s) => s.horizon);
  const hydrated = useHydrateStore();
  return useQuery({
    queryKey: ["portfolio", hlAddress, horizon],
    queryFn: () => api.getPositions(hlAddress, horizon),
    enabled: hydrated && !!hlAddress,
    refetchInterval: 30_000,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}
