"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  LineSeries,
  CandlestickSeries,
  BaselineSeries,
} from "lightweight-charts";
import { usePercentiles } from "@/hooks/useSynth";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface PriceChartProps {
  asset: string;
  height?: number;
}

// Map Synth assets to CoinGecko IDs for historical data
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

// For stocks we generate synthetic historical bars from the current price
// since free stock APIs require auth
function generateSyntheticHistory(currentPrice: number, count: number, baseTime: number, interval: number): any[] {
  const bars = [];
  let price = currentPrice;
  // Walk backwards from current price with random walk
  const prices = [currentPrice];
  for (let i = 1; i < count; i++) {
    const change = (Math.random() - 0.48) * currentPrice * 0.003; // slight downward bias to show "history"
    price = price - change;
    prices.unshift(price);
  }

  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    const volatility = currentPrice * 0.0015;
    const open = p + (Math.random() - 0.5) * volatility;
    const close = p + (Math.random() - 0.5) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.8;
    const low = Math.min(open, close) - Math.random() * volatility * 0.8;

    bars.push({
      time: (baseTime - (count - i) * interval) as any,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });
  }
  return bars;
}

export function PriceChart({ asset, height = 340 }: PriceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ReturnType<typeof createChart> | null>(null);
  const horizon = useSettingsStore((s) => s.horizon);
  const { data: res } = usePercentiles(asset);
  const [historyData, setHistoryData] = useState<any[] | null>(null);

  // Fetch real historical OHLC data via CoinGecko (7 days for crypto)
  useEffect(() => {
    const geckoId = COINGECKO_IDS[asset];
    if (!geckoId) {
      setHistoryData(null);
      return;
    }

    const fetchHistory = async () => {
      try {
        // 7 days gives ~168 4-hour candles — good density
        const resp = await fetch(
          `https://api.coingecko.com/api/v3/coins/${geckoId}/ohlc?vs_currency=usd&days=7`
        );
        if (resp.ok) {
          const data = await resp.json();
          const bars = data.map((d: number[]) => ({
            time: Math.floor(d[0] / 1000) as any,
            open: d[1],
            high: d[2],
            low: d[3],
            close: d[4],
          }));
          setHistoryData(bars);
        }
      } catch {
        setHistoryData(null);
      }
    };

    fetchHistory();
  }, [asset]);

  const buildChart = useCallback(() => {
    if (!chartRef.current || !res?.data) return;

    const rawData = res.data;
    const percentiles = rawData.forecast_future?.percentiles;
    const currentPrice = rawData.current_price;
    const startTime = rawData.forecast_start_time;

    if (!percentiles || percentiles.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0A0A0A" },
        textColor: "#8a8a8a",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.05)" },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: "#f5f8c2", width: 1, style: LineStyle.Solid, labelBackgroundColor: "#1a1a1a" },
        horzLine: { color: "#f5f8c2", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1a1a1a" },
      },
      rightPriceScale: {
        borderColor: "#2f2f2f",
        textColor: "#8a8a8a",
        scaleMargins: { top: 0.06, bottom: 0.06 },
      },
      timeScale: {
        borderColor: "#2f2f2f",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true },
    });

    chartInstanceRef.current = chart;

    const baseTime = startTime
      ? Math.floor(new Date(startTime).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const intervalSec = horizon === "1h" ? 60 : 300;

    // ── HISTORIC BARS (candlestick) ──
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80",
      downColor: "#ff3366",
      borderUpColor: "#4ade80",
      borderDownColor: "#ff3366",
      wickUpColor: "#4ade8088",
      wickDownColor: "#ff336688",
      priceLineVisible: false,
      lastValueVisible: false,
    });

    let historicBars: any[];
    if (historyData && historyData.length > 5) {
      // Use real data, filter to bars before forecast start
      historicBars = historyData.filter((b: any) => b.time < baseTime);
    } else {
      // Generate synthetic history (more bars for realistic look)
      const numBars = horizon === "1h" ? 60 : 120;
      historicBars = generateSyntheticHistory(currentPrice, numBars, baseTime, intervalSec);
    }
    candleSeries.setData(historicBars);

    // ── FORECAST: Baseline series (green above spot, red below) ──
    const forecastSeries = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price" as const, price: currentPrice },
      topLineColor: "#4ade80",
      topFillColor1: "rgba(74, 222, 128, 0.12)",
      topFillColor2: "rgba(74, 222, 128, 0.01)",
      bottomLineColor: "#ff3366",
      bottomFillColor1: "rgba(255, 51, 102, 0.01)",
      bottomFillColor2: "rgba(255, 51, 102, 0.12)",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: "#f5f8c2",
      crosshairMarkerBorderColor: "#0A0A0A",
      title: "FORECAST",
    });

    // Subsample forecast for cleaner look
    const step = Math.max(1, Math.floor(percentiles.length / 100));
    const forecastData = [];
    const seenTimes = new Set<number>();
    for (let i = 0; i < percentiles.length; i += step) {
      const t = baseTime + i * intervalSec;
      if (!seenTimes.has(t)) {
        seenTimes.add(t);
        forecastData.push({ time: t as any, value: percentiles[i]["0.5"] || currentPrice });
      }
    }
    // Include last point if not already
    const lastT = baseTime + (percentiles.length - 1) * intervalSec;
    if (!seenTimes.has(lastT)) {
      forecastData.push({ time: lastT as any, value: percentiles[percentiles.length - 1]["0.5"] || currentPrice });
    }
    forecastSeries.setData(forecastData);

    // P95 / P05 bounds
    const p95Series = chart.addSeries(LineSeries, {
      color: "rgba(74, 222, 128, 0.3)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const p05Series = chart.addSeries(LineSeries, {
      color: "rgba(255, 51, 102, 0.3)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    const p95Data: any[] = [];
    const p05Data: any[] = [];
    const seenBound = new Set<number>();
    for (let i = 0; i < percentiles.length; i += step) {
      const t = baseTime + i * intervalSec;
      if (!seenBound.has(t)) {
        seenBound.add(t);
        p95Data.push({ time: t as any, value: percentiles[i]["0.95"] || currentPrice });
        p05Data.push({ time: t as any, value: percentiles[i]["0.05"] || currentPrice });
      }
    }
    p95Series.setData(p95Data);
    p05Series.setData(p05Data);

    // Spot price line
    forecastSeries.createPriceLine({
      price: currentPrice,
      color: "#f5f8c2",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "SPOT",
    });

    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (chartRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: chartRef.current.clientWidth });
      }
    });
    observer.observe(chartRef.current);

    return () => {
      observer.disconnect();
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [res, asset, height, horizon, historyData]);

  useEffect(() => {
    const cleanup = buildChart();
    return () => cleanup?.();
  }, [buildChart]);

  if (!res?.data) {
    return (
      <div className="flex items-center justify-center bg-bg-tertiary" style={{ height }}>
        <span className="font-mono text-[10px] text-text-muted tracking-wider animate-pulse">LOADING...</span>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full" style={{ height }} />;
}
