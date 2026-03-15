import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  if (price >= 100) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatVol(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export const ASSETS = ["BTC", "ETH", "SOL", "XAU", "SPY", "NVDA", "TSLA", "AAPL", "GOOGL"];

export const ASSET_LABELS: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  XAU: "Gold",
  SPY: "S&P 500",
  NVDA: "NVIDIA",
  TSLA: "Tesla",
  AAPL: "Apple",
  GOOGL: "Google",
};

export const ASSET_CATEGORIES: Record<string, string> = {
  BTC: "Crypto",
  ETH: "Crypto",
  SOL: "Crypto",
  XAU: "Commodity",
  SPY: "Equity",
  NVDA: "Equity",
  TSLA: "Equity",
  AAPL: "Equity",
  GOOGL: "Equity",
};
