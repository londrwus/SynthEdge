"use client";

import { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { usePercentiles } from "@/hooks/useSynth";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface ProbabilityConeProps {
  asset: string;
  height?: number;
}

const BAND_CONFIGS = [
  { low: "0.05", high: "0.95", color: "rgba(245, 248, 194, 0.08)", stroke: "rgba(245, 248, 194, 0.15)", label: "P5\u2013P95", labelShort: "90% CI" },
  { low: "0.2", high: "0.8", color: "rgba(245, 248, 194, 0.14)", stroke: "rgba(245, 248, 194, 0.25)", label: "P20\u2013P80", labelShort: "60% CI" },
  { low: "0.35", high: "0.65", color: "rgba(245, 248, 194, 0.22)", stroke: "rgba(245, 248, 194, 0.35)", label: "P35\u2013P65", labelShort: "30% CI" },
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
    const isMobile = width < 480;
    const margin = {
      top: isMobile ? 20 : 30,
      right: isMobile ? 8 : 16,
      bottom: isMobile ? 32 : 40,
      left: isMobile ? 50 : 70,
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr("width", width).attr("height", height);

    // Unique clip ID
    const clipId = `cone-clip-${asset}-${Math.random().toString(36).slice(2, 8)}`;
    svg.append("defs").append("clipPath").attr("id", clipId)
      .append("rect").attr("width", innerWidth).attr("height", innerHeight);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const chartArea = g.append("g").attr("clip-path", `url(#${clipId})`);

    // --- Scales ---
    const originalXDomain: [number, number] = [0, percentiles.length - 1];
    const xScale = d3.scaleLinear().domain([...originalXDomain]).range([0, innerWidth]);

    const allPrices: number[] = percentiles.flatMap((p: Record<string, unknown>) =>
      Object.values(p).filter((v): v is number => typeof v === "number")
    );
    const priceMin = d3.min(allPrices) ?? currentPrice;
    const priceMax = d3.max(allPrices) ?? currentPrice;
    const pad = (priceMax - priceMin) * 0.12;
    const originalYDomain: [number, number] = [priceMin - pad, priceMax + pad];
    const yScale = d3.scaleLinear().domain([...originalYDomain]).range([innerHeight, 0]);

    // --- Grid lines group (redrawn on scale change) ---
    const gridG = g.append("g").attr("class", "grid-lines");

    function drawGrid() {
      gridG.selectAll("*").remove();
      yScale.ticks(6).forEach((tick) => {
        gridG.append("line")
          .attr("x1", 0).attr("x2", innerWidth)
          .attr("y1", yScale(tick)).attr("y2", yScale(tick))
          .attr("stroke", "rgba(255,255,255,0.04)")
          .attr("stroke-dasharray", "2,4");
      });
    }
    drawGrid();

    // --- Draw paths ---
    function rebuildPaths() {
      chartArea.selectAll("*").remove();

      BAND_CONFIGS.forEach(({ low, high, color, stroke }) => {
        const area = d3.area<Record<string, number>>()
          .x((_d, i) => xScale(i))
          .y0((d) => yScale(d[low] || currentPrice))
          .y1((d) => yScale(d[high] || currentPrice))
          .curve(d3.curveBasis);
        chartArea.append("path").datum(percentiles).attr("d", area).attr("fill", color);

        const upperLine = d3.line<Record<string, number>>().x((_d, i) => xScale(i)).y((d) => yScale(d[high] || currentPrice)).curve(d3.curveBasis);
        chartArea.append("path").datum(percentiles).attr("d", upperLine).attr("fill", "none").attr("stroke", stroke).attr("stroke-width", 0.5);

        const lowerLine = d3.line<Record<string, number>>().x((_d, i) => xScale(i)).y((d) => yScale(d[low] || currentPrice)).curve(d3.curveBasis);
        chartArea.append("path").datum(percentiles).attr("d", lowerLine).attr("fill", "none").attr("stroke", stroke).attr("stroke-width", 0.5);
      });

      const medLine = d3.line<Record<string, number>>().x((_d, i) => xScale(i)).y((d) => yScale(d["0.5"] || currentPrice)).curve(d3.curveBasis);
      chartArea.append("path").datum(percentiles).attr("d", medLine).attr("fill", "none").attr("stroke", "#f5f8c2").attr("stroke-width", 2);

      chartArea.append("line")
        .attr("x1", xScale(xScale.domain()[0])).attr("x2", xScale(xScale.domain()[1]))
        .attr("y1", yScale(currentPrice)).attr("y2", yScale(currentPrice))
        .attr("stroke", "#ffd700").attr("stroke-width", 1).attr("stroke-dasharray", "6,4").attr("opacity", 0.6);
    }
    rebuildPaths();

    // --- Y Axis ---
    const yAxisG = g.append("g");

    function updateYAxis() {
      yAxisG.selectAll("*").remove();
      yAxisG
        .call(d3.axisLeft(yScale).ticks(6).tickFormat((d) => `$${smartPrice(d as number)}`))
        .call((s) => s.select(".domain").remove())
        .call((s) => s.selectAll("text").attr("fill", "#8a8a8a").attr("font-size", isMobile ? "9px" : "10px").attr("font-family", "JetBrains Mono, monospace"))
        .call((s) => s.selectAll("line").attr("stroke", "rgba(255,255,255,0.08)"));
    }
    updateYAxis();

    // --- X Axis time labels ---
    const isHourly = percentiles.length <= 70;
    const xAxisG = g.append("g").attr("class", "x-axis-labels");

    function updateXAxis() {
      xAxisG.selectAll("*").remove();
      const [domStart, domEnd] = xScale.domain();
      const totalSteps = percentiles.length - 1;
      const stepMinutes = isHourly ? 1 : 5;

      // Generate labels based on current domain
      const tickCount = isMobile ? 3 : 5;
      const ticks: number[] = [];
      for (let i = 0; i < tickCount; i++) {
        ticks.push(domStart + (domEnd - domStart) * (i / (tickCount - 1)));
      }

      ticks.forEach((idx) => {
        const clampedIdx = Math.max(0, Math.min(idx, totalSteps));
        const minutes = clampedIdx * stepMinutes;
        let label: string;
        if (minutes === 0) label = "NOW";
        else if (minutes < 60) label = `+${Math.round(minutes)}m`;
        else label = `+${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)}h`;

        const xPos = xScale(clampedIdx);
        const anchor = xPos < 30 ? "start" : xPos > innerWidth - 30 ? "end" : "middle";

        xAxisG.append("text")
          .attr("x", xPos)
          .attr("y", innerHeight + 28)
          .attr("text-anchor", anchor)
          .attr("fill", "#6a6a6a").attr("font-size", "10px").attr("font-family", "JetBrains Mono, monospace")
          .text(label);
      });
    }
    updateXAxis();

    // --- Legend ---
    if (!isMobile) {
      const lastP = percentiles[percentiles.length - 1];
      if (lastP) {
        const legendItems = [
          { label: "SPOT", value: `$${smartPrice(currentPrice)}`, color: "#ffd700" },
          { label: "MEDIAN", value: `$${smartPrice(lastP["0.5"])}`, color: "#f5f8c2" },
          { label: "P5\u2013P95", value: `$${smartPrice(lastP["0.05"])} \u2013 $${smartPrice(lastP["0.95"])}`, color: "#8a8a8a" },
          { label: "P20\u2013P80", value: `$${smartPrice(lastP["0.2"])} \u2013 $${smartPrice(lastP["0.8"])}`, color: "#8a8a8a" },
        ];

        let xOff = 0;
        legendItems.forEach(({ label, value, color }) => {
          const labelW = label.length * 7;
          const valueW = value.length * 6.5;
          g.append("text").attr("x", xOff).attr("y", -12).attr("fill", color).attr("font-size", "10px").attr("font-weight", "600").attr("font-family", "JetBrains Mono, monospace").text(label);
          g.append("text").attr("x", xOff + labelW + 4).attr("y", -12).attr("fill", "#ffffff").attr("font-size", "10px").attr("font-family", "JetBrains Mono, monospace").text(value);
          xOff += labelW + valueW + 20;
        });
      }
    }

    // ========================================
    // DRAG-TO-SCALE: Y-axis (price) area
    // ========================================
    const yDragZone = svg.append("rect")
      .attr("x", 0)
      .attr("y", margin.top)
      .attr("width", margin.left)
      .attr("height", innerHeight)
      .attr("fill", "transparent")
      .style("cursor", "ns-resize");

    const yDrag = d3.drag<SVGRectElement, unknown>()
      .on("drag", (event) => {
        const [lo, hi] = yScale.domain();
        const range = hi - lo;
        // Drag up = zoom in (shrink domain), drag down = zoom out
        const factor = 1 + event.dy * 0.005;
        const center = (lo + hi) / 2;
        const newRange = range * factor;
        yScale.domain([center - newRange / 2, center + newRange / 2]);
        drawGrid();
        updateYAxis();
        rebuildPaths();
      });

    yDragZone.call(yDrag as any);

    // ========================================
    // DRAG-TO-SCALE: X-axis (time) area
    // ========================================
    const xDragZone = svg.append("rect")
      .attr("x", margin.left)
      .attr("y", margin.top + innerHeight)
      .attr("width", innerWidth)
      .attr("height", margin.bottom)
      .attr("fill", "transparent")
      .style("cursor", "ew-resize");

    const xDrag = d3.drag<SVGRectElement, unknown>()
      .on("drag", (event) => {
        const [lo, hi] = xScale.domain();
        const range = hi - lo;
        // Drag left = zoom in, drag right = zoom out
        const factor = 1 - event.dx * 0.005;
        const center = (lo + hi) / 2;
        const newRange = Math.max(10, Math.min(percentiles.length - 1, range * factor));
        const newLo = Math.max(0, center - newRange / 2);
        const newHi = Math.min(percentiles.length - 1, newLo + newRange);
        xScale.domain([newLo, newHi]);
        updateXAxis();
        rebuildPaths();
      });

    xDragZone.call(xDrag as any);

    // ========================================
    // SCROLL WHEEL zoom on chart area
    // ========================================
    svg.on("wheel", (event: WheelEvent) => {
      event.preventDefault();
      const [mx] = d3.pointer(event, g.node());

      // X-axis zoom centered on cursor position
      const [xLo, xHi] = xScale.domain();
      const xRange = xHi - xLo;
      const factor = event.deltaY > 0 ? 1.08 : 0.93;
      const cursorIdx = xScale.invert(mx);
      const ratioLeft = (cursorIdx - xLo) / xRange;
      const newRange = Math.max(10, Math.min(percentiles.length - 1, xRange * factor));
      const newLo = Math.max(0, cursorIdx - newRange * ratioLeft);
      const newHi = Math.min(percentiles.length - 1, newLo + newRange);
      xScale.domain([newLo, newHi]);

      updateXAxis();
      rebuildPaths();
    }, { passive: false } as any);

    // ========================================
    // DOUBLE-CLICK to reset
    // ========================================
    svg.on("dblclick", () => {
      xScale.domain([...originalXDomain]);
      yScale.domain([...originalYDomain]);
      drawGrid();
      updateYAxis();
      updateXAxis();
      rebuildPaths();
    });

    // ========================================
    // CROSSHAIR with CI band snapping
    // ========================================
    const crosshairG = g.append("g").style("display", "none");
    crosshairG.append("line").attr("class", "ch-v").attr("y1", 0).attr("y2", innerHeight)
      .attr("stroke", "#f5f8c2").attr("stroke-width", 0.5).attr("stroke-dasharray", "3,3").attr("opacity", 0.5);
    crosshairG.append("line").attr("class", "ch-h").attr("x1", 0).attr("x2", innerWidth)
      .attr("stroke", "#f5f8c2").attr("stroke-width", 0.5).attr("stroke-dasharray", "3,3").attr("opacity", 0.5);

    const bandHighlight = crosshairG.append("rect")
      .attr("fill", "rgba(245, 248, 194, 0.06)")
      .attr("stroke", "rgba(245, 248, 194, 0.2)")
      .attr("stroke-width", 0.5)
      .style("display", "none");

    const snapDot = crosshairG.append("circle")
      .attr("r", 4).attr("fill", "#f5f8c2").attr("stroke", "#0C0C0C").attr("stroke-width", 1.5)
      .style("display", "none");

    const tooltip = crosshairG.append("g");
    const tooltipBg = tooltip.append("rect").attr("fill", "#141414").attr("stroke", "#2f2f2f").attr("stroke-width", 1).attr("rx", 0);
    const lineCount = 7;
    const tooltipLines: d3.Selection<SVGTextElement, unknown, null, undefined>[] = [];
    for (let i = 0; i < lineCount; i++) {
      tooltipLines.push(
        tooltip.append("text")
          .attr("fill", i === 0 ? "#f5f8c2" : i === 6 ? "#4ade80" : "#8a8a8a")
          .attr("font-size", isMobile ? "9px" : "10px")
          .attr("font-weight", i === 0 || i === 6 ? "600" : "400")
          .attr("font-family", "JetBrains Mono, monospace")
      );
    }

    function getCIBand(p: Record<string, number>, cursorPrice: number) {
      const bands = [
        { key: "0.05", high: "0.95", label: "90% CI (P5\u2013P95)", idx: 0 },
        { key: "0.2", high: "0.8", label: "60% CI (P20\u2013P80)", idx: 1 },
        { key: "0.35", high: "0.65", label: "30% CI (P35\u2013P65)", idx: 2 },
      ];
      const snapThreshold = Math.abs(yScale.invert(0) - yScale.invert(8));

      for (const b of bands) {
        const lowVal = p[b.key] || 0;
        const highVal = p[b.high] || 0;
        if (Math.abs(cursorPrice - highVal) < snapThreshold) return { band: `${b.label} upper`, snappedPrice: highVal, bandIdx: b.idx };
        if (Math.abs(cursorPrice - lowVal) < snapThreshold) return { band: `${b.label} lower`, snappedPrice: lowVal, bandIdx: b.idx };
      }
      const median = p["0.5"] || 0;
      if (Math.abs(cursorPrice - median) < snapThreshold) return { band: "Median (P50)", snappedPrice: median, bandIdx: -1 };

      if (cursorPrice >= (p["0.35"] || 0) && cursorPrice <= (p["0.65"] || 0)) return { band: "Inside 30% CI", snappedPrice: null, bandIdx: 2 };
      if (cursorPrice >= (p["0.2"] || 0) && cursorPrice <= (p["0.8"] || 0)) return { band: "Inside 60% CI", snappedPrice: null, bandIdx: 1 };
      if (cursorPrice >= (p["0.05"] || 0) && cursorPrice <= (p["0.95"] || 0)) return { band: "Inside 90% CI", snappedPrice: null, bandIdx: 0 };
      return { band: "Outside 90% CI", snappedPrice: null, bandIdx: -2 };
    }

    const handlePointer = (event: MouseEvent | Touch) => {
      const [mx, my] = d3.pointer(event, g.node());
      if (mx < 0 || mx > innerWidth || my < 0 || my > innerHeight) {
        crosshairG.style("display", "none");
        return;
      }
      crosshairG.style("display", null);

      const rawIdx = xScale.invert(mx);
      const idx = Math.max(0, Math.min(Math.round(rawIdx), percentiles.length - 1));
      const p = percentiles[idx];
      if (!p) return;

      const x = xScale(idx);
      const cursorPrice = yScale.invert(my);
      const ciInfo = getCIBand(p, cursorPrice);
      const effectiveY = ciInfo.snappedPrice !== null ? yScale(ciInfo.snappedPrice) : my;

      crosshairG.select(".ch-v").attr("x1", x).attr("x2", x);
      crosshairG.select(".ch-h").attr("y1", effectiveY).attr("y2", effectiveY);

      if (ciInfo.snappedPrice !== null) {
        snapDot.style("display", null).attr("cx", x).attr("cy", effectiveY);
      } else {
        snapDot.style("display", "none");
      }

      if (ciInfo.bandIdx >= 0 && ciInfo.bandIdx < BAND_CONFIGS.length) {
        const bandCfg = BAND_CONFIGS[ciInfo.bandIdx];
        const bandTop = yScale(p[bandCfg.high] || 0);
        const bandBottom = yScale(p[bandCfg.low] || 0);
        bandHighlight.style("display", null).attr("x", x - 2).attr("y", bandTop).attr("width", 4).attr("height", Math.max(1, bandBottom - bandTop));
      } else {
        bandHighlight.style("display", "none");
      }

      const stepMin = isHourly ? idx : idx * 5;
      const timeLabel = stepMin < 60 ? `+${stepMin}m` : `+${(stepMin / 60).toFixed(1)}h`;
      const spread90 = ((p["0.95"] - p["0.05"]) / currentPrice * 100).toFixed(2);

      const lines = [
        `${timeLabel} (step ${idx}/${percentiles.length - 1})`,
        `P95: $${smartPrice(p["0.95"])}`,
        `P80: $${smartPrice(p["0.8"])}`,
        `P50: $${smartPrice(p["0.5"])}  (median)`,
        `P20: $${smartPrice(p["0.2"])}`,
        `P05: $${smartPrice(p["0.05"])}`,
        `${ciInfo.band} | Spread: ${spread90}%`,
      ];

      // Measure the widest line to size the tooltip box dynamically
      const charW = isMobile ? 5.8 : 6.2;
      const maxChars = Math.max(...lines.map((l) => l.length));
      const tooltipW = Math.max(isMobile ? 150 : 170, maxChars * charW + 20);
      const tooltipH = lineCount * 14 + 12;
      const tx = x > innerWidth * 0.55 ? x - tooltipW - 12 : x + 12;
      const ty = Math.max(10, Math.min(effectiveY - tooltipH / 2, innerHeight - tooltipH - 10));

      tooltipBg.attr("x", tx - 8).attr("y", ty - 6).attr("width", tooltipW).attr("height", tooltipH);
      tooltipLines.forEach((t, i) => t.attr("x", tx).attr("y", ty + 10 + i * 14).text(lines[i]));
    };

    // Set default cursor on chart area
    svg.style("cursor", "crosshair");

    svg
      .on("mouseenter", () => crosshairG.style("display", null))
      .on("mouseleave", () => crosshairG.style("display", "none"))
      .on("mousemove", handlePointer);

    // Touch support
    svg
      .on("touchstart", (e: TouchEvent) => { e.preventDefault(); crosshairG.style("display", null); handlePointer(e.touches[0]); }, { passive: false } as any)
      .on("touchmove", (e: TouchEvent) => { e.preventDefault(); handlePointer(e.touches[0]); }, { passive: false } as any)
      .on("touchend", () => crosshairG.style("display", "none"));

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
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="font-mono text-[8px] text-text-muted tracking-wider">
          DRAG AXES TO SCALE | SCROLL: ZOOM | DOUBLE-CLICK: RESET
        </span>
        <span className="font-mono text-[8px] text-text-muted tracking-wider hidden sm:inline">
          HOVER NEAR BAND EDGES TO SNAP
        </span>
      </div>
    </div>
  );
}
