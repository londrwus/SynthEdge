"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { usePercentiles } from "@/hooks/useSynth";
import { formatPrice } from "@/lib/utils";

interface ProbabilityConeProps {
  asset: string;
  height?: number;
}

const BAND_CONFIGS = [
  { low: "0.05", high: "0.95", color: "rgba(0, 255, 136, 0.06)", label: "90% CI" },
  { low: "0.2", high: "0.8", color: "rgba(0, 255, 136, 0.12)", label: "60% CI" },
  { low: "0.35", high: "0.65", color: "rgba(0, 255, 136, 0.22)", label: "30% CI" },
];

function smartPriceFormat(price: number): string {
  if (price >= 10000) return `$${d3.format(",.0f")(price)}`;
  if (price >= 100) return `$${d3.format(",.1f")(price)}`;
  return `$${d3.format(",.2f")(price)}`;
}

export function ProbabilityCone({ asset, height = 320 }: ProbabilityConeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: res, isLoading } = usePercentiles(asset);

  const drawChart = useCallback(() => {
    if (!svgRef.current || !res?.data) return;

    const rawData = res.data;
    const percentiles = rawData.forecast_future?.percentiles;
    const currentPrice = rawData.current_price;

    if (!percentiles || percentiles.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const container = containerRef.current;
    const width = container?.clientWidth || 600;
    const margin = { top: 16, right: 80, bottom: 32, left: 72 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height).style("cursor", "crosshair");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleLinear()
      .domain([0, percentiles.length - 1])
      .range([0, innerWidth]);

    const allPrices: number[] = percentiles.flatMap((p: any) =>
      Object.values(p).filter((v): v is number => typeof v === "number")
    );
    const priceMin = d3.min(allPrices) ?? currentPrice;
    const priceMax = d3.max(allPrices) ?? currentPrice;
    const pricePad = (priceMax - priceMin) * 0.08;

    const yScale = d3
      .scaleLinear()
      .domain([priceMin - pricePad, priceMax + pricePad])
      .range([innerHeight, 0]);

    // Grid lines
    g.selectAll(".grid-line")
      .data(yScale.ticks(5))
      .join("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", (d) => yScale(d))
      .attr("y2", (d) => yScale(d))
      .attr("stroke", "rgba(255,255,255,0.04)")
      .attr("stroke-dasharray", "2,4");

    // Bands (outer to inner)
    BAND_CONFIGS.forEach(({ low, high, color }) => {
      const area = d3
        .area<any>()
        .x((_d, i) => xScale(i))
        .y0((d) => yScale(d[low] || currentPrice))
        .y1((d) => yScale(d[high] || currentPrice))
        .curve(d3.curveBasis);

      g.append("path")
        .datum(percentiles)
        .attr("d", area)
        .attr("fill", color)
        .attr("stroke", "none");
    });

    // Median line
    const medianLine = d3
      .line<any>()
      .x((_d, i) => xScale(i))
      .y((d) => yScale(d["0.5"] || currentPrice))
      .curve(d3.curveBasis);

    g.append("path")
      .datum(percentiles)
      .attr("d", medianLine)
      .attr("fill", "none")
      .attr("stroke", "#00ff88")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "6,3");

    // Current price line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yScale(currentPrice))
      .attr("y2", yScale(currentPrice))
      .attr("stroke", "#ffd700")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 0.7);

    // Current price label (right side)
    g.append("rect")
      .attr("x", innerWidth + 4)
      .attr("y", yScale(currentPrice) - 8)
      .attr("width", 70)
      .attr("height", 16)
      .attr("fill", "#ffd700")
      .attr("rx", 0);

    g.append("text")
      .attr("x", innerWidth + 8)
      .attr("y", yScale(currentPrice) + 4)
      .attr("fill", "#0C0C0C")
      .attr("font-size", "9px")
      .attr("font-weight", "700")
      .attr("font-family", "JetBrains Mono, monospace")
      .text(smartPriceFormat(currentPrice));

    // Y axis
    g.append("g")
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((d) => smartPriceFormat(d as number))
      )
      .call((sel) => sel.select(".domain").remove())
      .call((sel) =>
        sel
          .selectAll("text")
          .attr("fill", "#6a6a6a")
          .attr("font-size", "9px")
          .attr("font-family", "JetBrains Mono, monospace")
      )
      .call((sel) => sel.selectAll("line").attr("stroke", "rgba(255,255,255,0.08)"));

    // X axis with time labels
    const totalSteps = percentiles.length;
    const isHourly = totalSteps <= 70;
    g.append("text")
      .attr("x", 0)
      .attr("y", innerHeight + 20)
      .attr("fill", "#6a6a6a")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, monospace")
      .text("NOW");

    g.append("text")
      .attr("x", innerWidth)
      .attr("y", innerHeight + 20)
      .attr("text-anchor", "end")
      .attr("fill", "#6a6a6a")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, monospace")
      .text(isHourly ? "+1H" : "+24H");

    g.append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#6a6a6a")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, monospace")
      .text(isHourly ? "+30M" : "+12H");

    // Band labels on right (with collision avoidance)
    const lastP = percentiles[percentiles.length - 1];
    if (lastP) {
      const labels = BAND_CONFIGS.map(({ low, high, label }) => ({
        label,
        y: (yScale(lastP[low]) + yScale(lastP[high])) / 2,
      }));

      // Avoid overlapping labels
      for (let i = 1; i < labels.length; i++) {
        if (Math.abs(labels[i].y - labels[i - 1].y) < 12) {
          labels[i].y = labels[i - 1].y + 12;
        }
      }

      labels.forEach(({ label, y }) => {
        g.append("text")
          .attr("x", innerWidth + 8)
          .attr("y", y + 3)
          .attr("fill", "#6a6a6a")
          .attr("font-size", "8px")
          .attr("font-family", "JetBrains Mono, monospace")
          .text(label);
      });
    }

    // === INTERACTIVE CROSSHAIR ===
    const crosshairG = g.append("g").style("display", "none");

    // Vertical line
    crosshairG
      .append("line")
      .attr("class", "crosshair-v")
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#00ff88")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.6);

    // Horizontal line
    crosshairG
      .append("line")
      .attr("class", "crosshair-h")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("stroke", "#00ff88")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "3,3")
      .attr("opacity", 0.6);

    // Tooltip bg
    const tooltipBg = crosshairG
      .append("rect")
      .attr("fill", "#141414")
      .attr("stroke", "#2f2f2f")
      .attr("stroke-width", 1)
      .attr("rx", 0);

    // Tooltip text lines
    const tooltipTexts = [0, 1, 2, 3, 4].map((i) =>
      crosshairG
        .append("text")
        .attr("fill", i === 0 ? "#00ff88" : "#8a8a8a")
        .attr("font-size", "9px")
        .attr("font-family", "JetBrains Mono, monospace")
    );

    // Mouse overlay
    svg
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("transform", `translate(${margin.left},${margin.top})`)
      .attr("fill", "transparent")
      .on("mouseenter", () => crosshairG.style("display", null))
      .on("mouseleave", () => crosshairG.style("display", "none"))
      .on("mousemove", (event: MouseEvent) => {
        const [mx, my] = d3.pointer(event, g.node());
        const idx = Math.round(xScale.invert(mx));
        const clampedIdx = Math.max(0, Math.min(idx, percentiles.length - 1));
        const p = percentiles[clampedIdx];
        if (!p) return;

        const x = xScale(clampedIdx);
        const price = yScale.invert(my);

        crosshairG.select(".crosshair-v").attr("x1", x).attr("x2", x);
        crosshairG.select(".crosshair-h").attr("y1", my).attr("y2", my);

        // Tooltip content
        const lines = [
          `STEP ${clampedIdx}/${totalSteps - 1}`,
          `P95: ${smartPriceFormat(p["0.95"])}`,
          `P50: ${smartPriceFormat(p["0.5"])}`,
          `P05: ${smartPriceFormat(p["0.05"])}`,
          `CURSOR: ${smartPriceFormat(price)}`,
        ];

        const tooltipX = x > innerWidth / 2 ? x - 130 : x + 10;
        const tooltipY = Math.max(0, Math.min(my - 20, innerHeight - 70));

        tooltipBg
          .attr("x", tooltipX - 4)
          .attr("y", tooltipY - 2)
          .attr("width", 125)
          .attr("height", 68);

        tooltipTexts.forEach((t, i) => {
          t.attr("x", tooltipX).attr("y", tooltipY + 10 + i * 13).text(lines[i]);
        });
      });
  }, [res, asset, height]);

  useEffect(() => {
    drawChart();

    const observer = new ResizeObserver(() => drawChart());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [drawChart]);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center bg-neon-green/5 animate-pulse"
        style={{ height }}
      >
        <span className="text-text-muted font-mono text-[11px] tracking-wider">
          LOADING PROBABILITY CONE...
        </span>
      </div>
    );
  }

  if (!res?.data) {
    return (
      <div
        className="flex items-center justify-center bg-bg-tertiary"
        style={{ height }}
      >
        <span className="text-text-muted font-mono text-[11px] tracking-wider">
          NO DATA FOR {asset}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
