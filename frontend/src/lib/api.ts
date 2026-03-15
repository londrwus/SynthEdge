const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  health: () => fetchAPI<any>("/api/health"),

  // Synth data
  getPercentiles: (asset: string, horizon = "24h") =>
    fetchAPI<any>(`/api/synth/percentiles?asset=${asset}&horizon=${horizon}`),
  getAllPercentiles: (horizon = "24h") =>
    fetchAPI<any>(`/api/synth/percentiles/all?horizon=${horizon}`),

  // Analytics
  getDerived: (asset: string, horizon = "24h") =>
    fetchAPI<any>(`/api/analytics/derived?asset=${asset}&horizon=${horizon}`),
  getAllDerived: (horizon = "24h") =>
    fetchAPI<any>(`/api/analytics/derived/all?horizon=${horizon}`),
  getScanner: (horizon = "24h") =>
    fetchAPI<any>(`/api/analytics/scanner?horizon=${horizon}`),
  calculateKelly: (body: {
    asset: string;
    direction: string;
    entry: number;
    tp: number;
    sl: number;
    horizon?: string;
    fraction?: number;
  }) =>
    fetchAPI<any>("/api/analytics/kelly", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getLiquidationRisk: (params: {
    asset: string;
    entry_price: number;
    leverage: number;
    direction?: string;
    horizon?: string;
  }) => {
    const sp = new URLSearchParams(params as any);
    return fetchAPI<any>(`/api/analytics/liquidation-risk?${sp}`);
  },

  // Portfolio
  getPositions: (address: string, horizon = "24h") =>
    fetchAPI<any>(
      `/api/portfolio/positions?address=${address}&horizon=${horizon}`
    ),
  getSummary: (address: string, horizon = "24h") =>
    fetchAPI<any>(
      `/api/portfolio/summary?address=${address}&horizon=${horizon}`
    ),

  // Deep Insights (on-demand)
  getOptions: (asset: string, horizon = "24h") =>
    fetchAPI<any>(`/api/insights/options?asset=${asset}&horizon=${horizon}`),
  getLiquidationProbs: (asset: string, horizon = "24h") =>
    fetchAPI<any>(`/api/insights/liquidation?asset=${asset}&horizon=${horizon}`),
  getLpBounds: (asset: string, horizon = "24h") =>
    fetchAPI<any>(`/api/insights/lp-bounds?asset=${asset}&horizon=${horizon}`),
  getCrossAssetVol: () =>
    fetchAPI<any>("/api/insights/cross-asset-vol"),
  getDistribution: (asset: string, horizon = "24h") =>
    fetchAPI<any>(`/api/insights/distribution?asset=${asset}&horizon=${horizon}`),
  getVolTermStructure: (asset: string) =>
    fetchAPI<any>(`/api/insights/vol-term-structure?asset=${asset}`),

  // Trading (Hyperliquid execution)
  placeMarketOrder: (body: {
    asset: string;
    is_buy: boolean;
    size: number;
    leverage?: number;
    private_key?: string;
    account_address?: string;
  }) =>
    fetchAPI<any>("/api/trading/market-order", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  placeSmartOrder: (body: {
    asset: string;
    is_buy: boolean;
    size: number;
    private_key?: string;
    account_address?: string;
    horizon?: string;
  }) =>
    fetchAPI<any>("/api/trading/smart-order", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  closePosition: (body: { asset: string; private_key?: string; account_address?: string }) =>
    fetchAPI<any>("/api/trading/close", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getOpenOrders: (address: string) =>
    fetchAPI<any>(`/api/trading/open-orders?address=${address}`),
  getUserFills: (address: string) =>
    fetchAPI<any>(`/api/trading/user-fills?address=${address}`),

  // Earnings
  getEarningsDashboard: (horizon = "24h") =>
    fetchAPI<any>(`/api/earnings/dashboard?horizon=${horizon}`),

  // System
  forceRefresh: () =>
    fetchAPI<any>("/api/refresh", { method: "POST" }),
};
