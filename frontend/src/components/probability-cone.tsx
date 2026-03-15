"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { usePercentiles } from "@/hooks/useSynth";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { formatPrice } from "@/lib/utils";

interface ProbabilityConeProps {
  asset: string;
  height?: number;
}

const BAND_CONFIGS = [
  { low: "0.05", high: "0.95", color: "rgba(245, 248, 194, 0.08)", stroke: "rgba(245, 248, 194, 0.15)", label: "P5–P95" },
  { low: "0.2", high: "0.8", color: "rgba(245, 248, 194, 0.14)", stroke: "rgba(245, 248, 194, 0.25)", label: "P20–P80" },
  { low: "0.35", high: "0.65", color: "rgba(245, 248, 194, 0.22)", stroke: "rgba(245, 248, 194, 0.35)", label: "P35–P65" },
];

function smartPrice(price: number): string {
  if (price >= 10000) return d3.format(",.0f")(price);
  if (price >= 100) return d3.format(",.1f")(price);
  return d3.format(",.2f")(price);
}

export function ProbabilityCone({ asset, height = 360 }: ProbabilityConeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const horizon = useSettingsStore((s) => s.horizon);
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
    const width = container?.clientWidth || 700;
    const margin = { top: 30, right: 16, bottom: 40, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height).style("cursor", "crosshair");

    // Clip path for zoom
    svg.append("defs").append("clipPath").attr("id", "cone-clip")
      .append("rect").attr("width", innerWidth).attr("height", innerHeight);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const chartArea = g.append("g").attr("clip-path", "url(#cone-clip)");

    // Scales
    const xScale = d3.scaleLinear().domain([0, percentiles.length - 1]).range([0, innerWidth]);

    const allPrices: number[] = percentiles.flatMap((p: any) =>
      Object.values(p).filter((v): v is number => typeof v === "number")
    );
    const priceMin = d3.min(allPrices) ?? currentPrice;
    const priceMax = d3.max(allPrices) ?? currentPrice;
    const pad = (priceMax - priceMin) * 0.12;
    const yScale = d3.scaleLinear().domain([priceMin - pad, priceMax + pad]).range([innerHeight, 0]);

    // Grid
    yScale.ticks(6).forEach((tick) => {
      g.append("line")
        .attr("x1", 0).attr("x2", innerWidth)
        .attr("y1", yScale(tick)).attr("y2", yScale(tick))
        .attr("stroke", "rgba(255,255,255,0.04)")
        .attr("stroke-dasharray", "2,4");
    });

    // Bands with edge lines (drawn in chartArea for zoom clipping)
    BAND_CONFIGS.forEach(({ low, high, color, stroke }) => {
      const area = d3.area<any>()
        .x((_d, i) => xScale(i))
        .y0((d) => yScale(d[low] || currentPrice))
        .y1((d) => yScale(d[high] || currentPrice))
        .curve(d3.curveBasis);

      chartArea.append("path").datum(percentiles).attr("d", area).attr("fill", color);

      const upperLine = d3.line<any>().x((_d, i) => xScale(i)).y((d) => yScale(d[high] || currentPrice)).curve(d3.curveBasis);
      chartArea.append("path").datum(percentiles).attr("d", upperLine).attr("fill", "none").attr("stroke", stroke).attr("stroke-width", 0.5);

      const lowerLine = d3.line<any>().x((_d, i) => xScale(i)).y((d) => yScale(d[low] || currentPrice)).curve(d3.curveBasis);
      chartArea.append("path").datum(percentiles).attr("d", lowerLine).attr("fill", "none").attr("stroke", stroke).attr("stroke-width", 0.5);
    });

    // Median line
    const medianLine = d3.line<any>().x((_d, i) => xScale(i)).y((d) => yScale(d["0.5"] || currentPrice)).curve(d3.curveBasis);
    chartArea.append("path").datum(percentiles).attr("d", medianLine).attr("fill", "none").attr("stroke", "#f5f8c2").attr("stroke-width", 2);

    // Current price line
    chartArea.append("line")
      .attr("x1", 0).attr("x2", innerWidth)
      .attr("y1", yScale(currentPrice)).attr("y2", yScale(currentPrice))
      .attr("stroke", "#ffd700").attr("stroke-width", 1).attr("stroke-dasharray", "6,4").attr("opacity", 0.6);

    // Y axis
    g.append("g")
      .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `$${smartPrice(d as number)}`))
      .call((s) => s.select(".domain").remove())
      .call((s) => s.selectAll("text").attr("fill", "#8a8a8a").attr("font-size", "10px").attr("font-family", "JetBrains Mono, monospace"))
      .call((s) => s.selectAll("line").attr("stroke", "rgba(255,255,255,0.08)"));

    // X axis time labels
    const isHourly = percentiles.length <= 70;
    const xLabels = isHourly
      ? [{ pos: 0, text: "NOW" }, { pos: 0.5, text: "+30M" }, { pos: 1, text: "+1H" }]
      : [{ pos: 0, text: "NOW" }, { pos: 0.25, text: "+6H" }, { pos: 0.5, text: "+12H" }, { pos: 0.75, text: "+18H" }, { pos: 1, text: "+24H" }];

    xLabels.forEach(({ pos, text }) => {
      g.append("text")
        .attr("x", innerWidth * pos)
        .attr("y", innerHeight + 28)
        .attr("text-anchor", pos === 0 ? "start" : pos === 1 ? "end" : "middle")
        .attr("fill", "#6a6a6a").attr("font-size", "10px").attr("font-family", "JetBrains Mono, monospace")
        .text(text);
    });

    // TOP LEGEND (instead of cramped right-side labels)
    const lastP = percentiles[percentiles.length - 1];
    if (lastP) {
      const legendItems = [
        { label: "SPOT", value: `$${smartPrice(currentPrice)}`, color: "#ffd700" },
        { label: "MEDIAN", value: `$${smartPrice(lastP["0.5"])}`, color: "#f5f8c2" },
        { label: "P5–P95", value: `$${smartPrice(lastP["0.05"])} – $${smartPrice(lastP["0.95"])}`, color: "#8a8a8a" },
        { label: "P20–P80", value: `$${smartPrice(lastP["0.2"])} – $${smartPrice(lastP["0.8"])}`, color: "#8a8a8a" },
      ];

      let xOff = 0;
      legendItems.forEach(({ label, value, color }) => {
        const labelW = label.length * 7;
        const valueW = value.length * 6.5;

        g.append("text")
          .attr("x", xOff).attr("y", -12)
          .attr("fill", color).attr("font-size", "10px").attr("font-weight", "600")
          .attr("font-family", "JetBrains Mono, monospace")
          .text(label);

        g.append("text")
          .attr("x", xOff + labelW + 4).attr("y", -12)
          .attr("fill", "#ffffff").attr("font-size", "10px")
          .attr("font-family", "JetBrains Mono, monospace")
          .text(value);

        xOff += labelW + valueW + 20;
      });
    }

    // ZOOM & PAN — X-axis only (zooms timeline, not price axis)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [innerWidth, innerHeight]])
      .extent([[0, 0], [innerWidth, innerHeight]])
      .on("zoom", (event) => {
        // Apply transform only to X, keep Y fixed
        const t = event.transform;
        chartArea.attr("transform", `translate(${t.x},0) scale(${t.k},1)`);
      });

    svg.call(zoom);
    svg.on("dblclick.zoom", () => {
      svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
    });

    // INTERACTIVE CROSSHAIR
    const crosshairG = g.append("g").style("display", "none");
    crosshairG.append("line").attr("class", "ch-v").attr("y1", 0).attr("y2", innerHeight)
      .attr("stroke", "#f5f8c2").attr("stroke-width", 0.5).attr("stroke-dasharray", "3,3").attr("opacity", 0.5);
    crosshairG.append("line").attr("class", "ch-h").attr("x1", 0).attr("x2", innerWidth)
      .attr("stroke", "#f5f8c2").attr("stroke-width", 0.5).attr("stroke-dasharray", "3,3").attr("opacity", 0.5);

    const tooltip = crosshairG.append("g");
    const tooltipBg = tooltip.append("rect").attr("fill", "#141414").attr("stroke", "#2f2f2f").attr("stroke-width", 1).attr("rx", 0);
    const tooltipLines: d3.Selection<SVGTextElement, unknown, null, undefined>[] = [];
    for (let i = 0; i < 5; i++) {
      tooltipLines.push(
        tooltip.append("text")
          .attr("fill", i === 0 ? "#f5f8c2" : "#8a8a8a")
          .attr("font-size", "10px").attr("font-weight", i === 0 ? "600" : "400")
          .attr("font-family", "JetBrains Mono, monospace")
      );
    }

    // Mouse events directly on SVG (doesn't block zoom)
    svg
      .on("mouseenter", () => crosshairG.style("display", null))
      .on("mouseleave", () => crosshairG.style("display", "none"))
      .on("mousemove", (event: MouseEvent) => {
        const [mx, my] = d3.pointer(event, g.node());
        const idx = Math.max(0, Math.min(Math.round(xScale.invert(mx)), percentiles.length - 1));
        const p = percentiles[idx];
        if (!p) return;

        const x = xScale(idx);
        crosshairG.select(".ch-v").attr("x1", x).attr("x2", x);
        crosshairG.select(".ch-h").attr("y1", my).attr("y2", my);

        const stepMin = isHourly ? idx : idx * 5;
        const timeLabel = stepMin < 60 ? `+${stepMin}m` : `+${(stepMin / 60).toFixed(1)}h`;

        const lines = [
          `${timeLabel} (step ${idx}/${percentiles.length - 1})`,
          `P95: $${smartPrice(p["0.95"])}`,
          `P50: $${smartPrice(p["0.5"])}`,
          `P05: $${smartPrice(p["0.05"])}`,
          `Cursor: $${smartPrice(yScale.invert(my))}`,
        ];

        const tx = x > innerWidth * 0.6 ? x - 160 : x + 12;
        const ty = Math.max(10, Math.min(my - 30, innerHeight - 80));

        tooltipBg.attr("x", tx - 6).attr("y", ty - 4).attr("width", 155).attr("height", 74);
        tooltipLines.forEach((t, i) => t.attr("x", tx).attr("y", ty + 10 + i * 14).text(lines[i]));
      });
  }, [res, asset, height, horizon]);

  useEffect(() => {
    drawChart();
    const observer = new ResizeObserver(() => drawChart());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [drawChart]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center bg-neon-green/5 animate-pulse" style={{ height }}>
        <span className="text-text-muted font-mono text-[11px] tracking-wider">LOADING CONE...</span>
      </div>
    );
  }

  if (!res?.data) {
    return (
      <div className="flex items-center justify-center bg-bg-tertiary" style={{ height }}>
        <span className="text-text-muted font-mono text-[11px] tracking-wider">NO DATA FOR {asset}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
