"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, LineStyle, LineSeries } from "lightweight-charts";
import { usePercentiles } from "@/hooks/useSynth";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface PriceChartProps {
  asset: string;
  height?: number;
}

export function PriceChart({ asset, height = 200 }: PriceChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ReturnType<typeof createChart> | null>(null);
  const horizon = useSettingsStore((s) => s.horizon);
  const { data: res } = usePercentiles(asset);

  useEffect(() => {
    if (!chartRef.current || !res?.data) return;

    const rawData = res.data;
    const percentiles = rawData.forecast_future?.percentiles;
    const currentPrice = rawData.current_price;
    const startTime = rawData.forecast_start_time;

    if (!percentiles || percentiles.length === 0) return;

    // Clean up previous chart
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#0A0A0A" },
        textColor: "#6a6a6a",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        vertLine: { color: "#00ff88", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#141414" },
        horzLine: { color: "#00ff88", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#141414" },
      },
      rightPriceScale: {
        borderColor: "#2f2f2f",
        textColor: "#6a6a6a",
      },
      timeScale: {
        borderColor: "#2f2f2f",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: false,
      handleScale: false,
    });

    chartInstanceRef.current = chart;

    // Create time from start time
    const baseTime = startTime
      ? Math.floor(new Date(startTime).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const intervalSec = horizon === "1h" ? 60 : 300; // 1min or 5min

    // Median line (main series)
    const medianSeries = chart.addSeries(LineSeries,{
      color: "#00ff88",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      title: "P50",
    });

    const medianData = percentiles.map((p: any, i: number) => ({
      time: (baseTime + i * intervalSec) as any,
      value: p["0.5"] || currentPrice,
    }));
    medianSeries.setData(medianData);

    // P95 upper band
    const p95Series = chart.addSeries(LineSeries,{
      color: "rgba(0, 255, 136, 0.3)",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "P95",
    });
    p95Series.setData(
      percentiles.map((p: any, i: number) => ({
        time: (baseTime + i * intervalSec) as any,
        value: p["0.95"] || currentPrice,
      }))
    );

    // P05 lower band
    const p05Series = chart.addSeries(LineSeries,{
      color: "rgba(255, 51, 102, 0.3)",
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      title: "P05",
    });
    p05Series.setData(
      percentiles.map((p: any, i: number) => ({
        time: (baseTime + i * intervalSec) as any,
        value: p["0.05"] || currentPrice,
      }))
    );

    // Current price marker
    medianSeries.createPriceLine({
      price: currentPrice,
      color: "#ffd700",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "SPOT",
    });

    chart.timeScale().fitContent();

    // Resize observer
    const observer = new ResizeObserver(() => {
      if (chartRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartRef.current.clientWidth,
        });
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
  }, [res, asset, height, horizon]);

  if (!res?.data) {
    return (
      <div
        className="flex items-center justify-center bg-bg-tertiary"
        style={{ height }}
      >
        <span className="font-mono text-[10px] text-text-muted tracking-wider">
          LOADING CHART...
        </span>
      </div>
    );
  }

  return <div ref={chartRef} className="w-full" style={{ height }} />;
}
