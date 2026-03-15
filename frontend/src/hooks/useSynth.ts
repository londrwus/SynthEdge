"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSettingsStore } from "@/stores/useSettingsStore";

/**
 * All hooks use placeholderData: keepPreviousData to prevent
 * the UI from flickering/emptying when refetching.
 * staleTime prevents unnecessary re-renders when data hasn't changed.
 */

export function useScanner() {
  const horizon = useSettingsStore((s) => s.horizon);
  return useQuery({
    queryKey: ["scanner", horizon],
    queryFn: () => api.getScanner(horizon),
    refetchInterval: 15_000,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function useAllDerived() {
  const horizon = useSettingsStore((s) => s.horizon);
  return useQuery({
    queryKey: ["derived", "all", horizon],
    queryFn: () => api.getAllDerived(horizon),
    refetchInterval: 15_000,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });
}

export function usePercentiles(asset: string) {
  const horizon = useSettingsStore((s) => s.horizon);
  return useQuery({
    queryKey: ["percentiles", asset, horizon],
    queryFn: () => api.getPercentiles(asset, horizon),
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled: !!asset,
    placeholderData: keepPreviousData,
  });
}

export function usePortfolio() {
  const hlAddress = useSettingsStore((s) => s.hlAddress);
  const horizon = useSettingsStore((s) => s.horizon);
  return useQuery({
    queryKey: ["portfolio", hlAddress, horizon],
    queryFn: () => api.getPositions(hlAddress, horizon),
    enabled: !!hlAddress,
    refetchInterval: 30_000,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}
