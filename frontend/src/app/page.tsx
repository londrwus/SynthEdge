"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { motion, useInView, AnimatePresence, useScroll, useTransform } from "framer-motion";

/* ═══════════════════════════════════════════════════════════════ */
/*  PRIMITIVES                                                     */
/* ═══════════════════════════════════════════════════════════════ */

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.4, delay, ease: "easeOut" }} className={className}>
      {children}
    </motion.div>
  );
}

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let s = 0;
    const step = Math.max(1, Math.floor(value / 25));
    const id = setInterval(() => { s += step; if (s >= value) { setCount(value); clearInterval(id); } else setCount(s); }, 20);
    return () => clearInterval(id);
  }, [inView, value]);
  return <span ref={ref} className="tabular-nums">{count}{suffix}</span>;
}


/* ─── Glitch Text ─── */
function GlitchText({ text, className = "" }: { text: string; className?: string }) {
  const [g, setG] = useState(false);
  useEffect(() => { const id = setInterval(() => { setG(true); setTimeout(() => setG(false), 120); }, 5000 + Math.random() * 3000); return () => clearInterval(id); }, []);
  return (
    <span className={`relative inline-block ${className}`}>
      {g && <><span className="absolute top-0 left-[2px] text-bear/20 clip-glitch-1">{text}</span><span className="absolute top-0 left-[-2px] text-neon-green/20 clip-glitch-2">{text}</span></>}
      {text}
    </span>
  );
}

/* ─── Visibility pause hook for canvas backgrounds ─── */
function useCanvasVisible(ref: React.RefObject<HTMLCanvasElement | null>) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return visible;
}

/* ─── Flow Field Background (inspired by Radiant Shaders) ─── */
function FlowField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visible = useCanvasVisible(canvasRef);
  const visRef = useRef(visible);
  visRef.current = visible;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const particles: { x: number; y: number; life: number; maxLife: number }[] = [];
    const COUNT = 180;
    let cw = 0, ch = 0;
    const resize = () => {
      cw = canvas.offsetWidth;
      ch = canvas.offsetHeight;
      canvas.width = cw * dpr;
      canvas.height = ch * dpr;
      ctx.scale(dpr, dpr);
      particles.length = 0;
      for (let i = 0; i < COUNT; i++) {
        particles.push({ x: Math.random() * cw, y: Math.random() * ch, life: Math.random() * 250, maxLife: 200 + Math.random() * 150 });
      }
    };
    resize();
    let t = 0;
    const TWO_PI = Math.PI * 2;
    const draw = () => {
      animId = requestAnimationFrame(draw);
      if (!visRef.current) return;
      ctx.fillStyle = "rgba(10,10,10,0.06)";
      ctx.fillRect(0, 0, cw, ch);
      t += 0.004;
      for (const p of particles) {
        const angle = (Math.sin(p.x * 0.003 + t) * Math.cos(p.y * 0.004 + t * 0.7) +
          Math.sin(p.x * 0.002 - p.y * 0.003 + t * 0.4) * 0.5 +
          Math.cos(p.x * 0.005 + p.y * 0.002 + t * 1.1) * 0.3) * TWO_PI;
        p.x += Math.cos(angle) * 0.6;
        p.y += Math.sin(angle) * 0.6;
        p.life++;
        if (p.life > p.maxLife || p.x < -10 || p.x > cw + 10 || p.y < -10 || p.y > ch + 10) {
          p.x = Math.random() * cw;
          p.y = Math.random() * ch;
          p.life = 0;
          p.maxLife = 200 + Math.random() * 150;
        }
        const a = Math.min(p.life / 40, (p.maxLife - p.life) / 40, 1) * 0.35;
        ctx.fillStyle = `rgba(245,248,194,${a})`;
        ctx.fillRect(p.x, p.y, 1.2, 1.2);
      }
    };
    draw();
    const onResize = () => { ctx.setTransform(1, 0, 0, 1, 0, 0); resize(); ctx.fillStyle = "rgba(10,10,10,1)"; ctx.fillRect(0, 0, cw, ch); };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-50 pointer-events-none" />;
}

/* ─── Topographic Contour Background (inspired by Radiant Shaders) ─── */
function TopoField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visible = useCanvasVisible(canvasRef);
  const visRef = useRef(visible);
  visRef.current = visible;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const dpr = Math.min(window.devicePixelRatio, 2);
    let w = 0, h = 0;
    const resize = () => {
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    // Layered simplex-like noise
    const n = (x: number, y: number, t: number) => {
      const s1 = Math.sin(x * 0.006 + t * 0.3) * Math.cos(y * 0.007 - t * 0.2);
      const s2 = Math.sin(x * 0.012 - y * 0.009 + t * 0.15) * 0.5;
      const s3 = Math.cos(x * 0.004 + y * 0.005 + t * 0.4) * 0.3;
      return s1 + s2 + s3;
    };
    let t = 0;
    const LEVELS = 10;
    const STEP = 12;
    const draw = () => {
      animId = requestAnimationFrame(draw);
      if (!visRef.current) return;
      ctx.clearRect(0, 0, w, h);
      t += 0.006;
      // Sample grid
      const cols = Math.ceil(w / STEP) + 1;
      const rows = Math.ceil(h / STEP) + 1;
      const grid: number[][] = [];
      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          grid[r][c] = n(c * STEP, r * STEP, t);
        }
      }
      // Marching squares for each contour level
      for (let lv = 0; lv < LEVELS; lv++) {
        const threshold = -1.5 + (lv / LEVELS) * 3;
        const isMajor = lv % 3 === 0;
        ctx.strokeStyle = isMajor
          ? `rgba(245,248,194,${0.07})`
          : `rgba(245,248,194,${0.03})`;
        ctx.lineWidth = isMajor ? 1 : 0.5;
        ctx.beginPath();
        for (let r = 0; r < rows - 1; r++) {
          for (let c = 0; c < cols - 1; c++) {
            const tl = grid[r][c] >= threshold ? 1 : 0;
            const tr = grid[r][c + 1] >= threshold ? 1 : 0;
            const br = grid[r + 1][c + 1] >= threshold ? 1 : 0;
            const bl = grid[r + 1][c] >= threshold ? 1 : 0;
            const sq = (tl << 3) | (tr << 2) | (br << 1) | bl;
            if (sq === 0 || sq === 15) continue;
            const x = c * STEP, y2 = r * STEP;
            const lerp = (a: number, b: number) => {
              const d = b - a;
              return d === 0 ? 0.5 : (threshold - a) / d;
            };
            const top = x + lerp(grid[r][c], grid[r][c + 1]) * STEP;
            const bot = x + lerp(grid[r + 1][c], grid[r + 1][c + 1]) * STEP;
            const left = y2 + lerp(grid[r][c], grid[r + 1][c]) * STEP;
            const right = y2 + lerp(grid[r][c + 1], grid[r + 1][c + 1]) * STEP;
            const seg = (ax: number, ay: number, bx: number, by: number) => {
              ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
            };
            switch (sq) {
              case 1: case 14: seg(x, left, bot, y2 + STEP); break;
              case 2: case 13: seg(bot, y2 + STEP, x + STEP, right); break;
              case 3: case 12: seg(x, left, x + STEP, right); break;
              case 4: case 11: seg(top, y2, x + STEP, right); break;
              case 5: seg(top, y2, x, left); seg(bot, y2 + STEP, x + STEP, right); break;
              case 6: case 9: seg(top, y2, bot, y2 + STEP); break;
              case 7: case 8: seg(x, left, top, y2); break;
              case 10: seg(top, y2, x + STEP, right); seg(x, left, bot, y2 + STEP); break;
            }
          }
        }
        ctx.stroke();
      }
    };
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

/* ─── Text Scramble (inspired by Motion Core) ─── */
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*";
function TextScramble({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  const [display, setDisplay] = useState(text);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  useEffect(() => {
    if (!inView) return;
    const timeout = setTimeout(() => {
      let iter = 0;
      const id = setInterval(() => {
        setDisplay(
          text.split("").map((ch, i) => {
            if (ch === " ") return " ";
            if (i < iter) return text[i];
            return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }).join("")
        );
        iter += 0.35;
        if (iter >= text.length) { setDisplay(text); clearInterval(id); }
      }, 35);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [inView, text, delay]);
  return <span ref={ref} className={className}>{display}</span>;
}

/* ═══════════════════════════════════════════════════════════════ */
/*  LIVE DATA HOOKS — single shared ticker, no per-component poll */
/* ═══════════════════════════════════════════════════════════════ */

const PRICES: Record<string, number> = { BTC: 67482, ETH: 3847, SOL: 178.4, SPY: 542.1, NVDA: 134.8, TSLA: 247.6, AAPL: 197.9, GOOGL: 175.5, XAU: 2341 };
type AssetData = { price: number; prob: number; vol: number; direction: "bullish" | "bearish"; change: number };

// Deterministic defaults for SSR — no Math.random() at module scope
const defaultAsset = (symbol: string): AssetData => {
  const base = PRICES[symbol] || 100;
  return { price: base, prob: 0.55, vol: 34, direction: "bullish", change: 0.6 };
};

const genAsset = (symbol: string): AssetData => {
  const base = PRICES[symbol] || 100;
  const prob = 0.38 + Math.random() * 0.3;
  return { price: base * (1 + (Math.random() - 0.5) * 0.008), prob, vol: 12 + Math.random() * 55, direction: prob > 0.5 ? "bullish" : "bearish", change: (Math.random() - 0.45) * 4 };
};

// Single shared store — one interval updates all assets, all components read from it
const ALL_SYMBOLS = Object.keys(PRICES);
let sharedData: Record<string, AssetData> | null = null;
const listeners: Set<() => void> = new Set();
let tickerStarted = false;
function startTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  // First client-side randomization
  const init: Record<string, AssetData> = {};
  ALL_SYMBOLS.forEach(s => { init[s] = genAsset(s); });
  sharedData = init;
  listeners.forEach(fn => fn());
  setInterval(() => {
    const next: Record<string, AssetData> = {};
    ALL_SYMBOLS.forEach(s => { next[s] = genAsset(s); });
    sharedData = next;
    listeners.forEach(fn => fn());
  }, 2500);
}

function useLiveAsset(symbol: string) {
  const [d, setD] = useState<AssetData>(() => defaultAsset(symbol));
  useEffect(() => {
    startTicker();
    // Immediately sync with shared data after mount
    if (sharedData) setD(sharedData[symbol]);
    const update = () => { if (sharedData) setD(sharedData[symbol]); };
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, [symbol]);
  return d;
}

/* ═══════════════════════════════════════════════════════════════ */
/*  BENTO CARD COMPONENTS                                          */
/* ═══════════════════════════════════════════════════════════════ */

/* ─── Probability Cone ─── */
function ConeCard() {
  const [pts, setPts] = useState<{ p05: number; p20: number; p50: number; p80: number; p95: number }[]>([]);
  useEffect(() => {
    const gen = () => {
      const base = 67500, out = [];
      let drift = (Math.random() - 0.45) * 0.0003;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, sp = t * (750 + Math.random() * 250);
        const mid = base + drift * base * i + (Math.random() - 0.5) * 30;
        out.push({ p05: mid - sp * 1.8, p20: mid - sp * 0.9, p50: mid, p80: mid + sp * 0.9, p95: mid + sp * 1.8 });
        drift += (Math.random() - 0.48) * 0.00005;
      }
      setPts(out);
    };
    gen(); const id = setInterval(gen, 3500); return () => clearInterval(id);
  }, []);
  if (!pts.length) return null;
  const w = 400, h = 160, vals = pts.flatMap(p => [p.p05, p.p95]);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const sx = (i: number) => (i / 40) * w, sy = (v: number) => h - ((v - mn) / (mx - mn)) * h;
  const path = (k: "p05"|"p20"|"p50"|"p80"|"p95") => pts.map((p, i) => `${i ? "L" : "M"}${sx(i)},${sy(p[k])}`).join(" ");
  const area = (t: "p05"|"p20", b: "p95"|"p80") => `${pts.map((p, i) => `${i ? "L" : "M"}${sx(i)},${sy(p[t])}`).join(" ")} ${[...pts].reverse().map((p, i) => `L${sx(pts.length - 1 - i)},${sy(p[b])}`).join(" ")} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
      <motion.path d={area("p05", "p95")} fill="rgba(245,248,194,0.04)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      <motion.path d={area("p20", "p80")} fill="rgba(245,248,194,0.08)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.15 }} />
      <motion.path d={path("p50")} fill="none" stroke="#f5f8c2" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
      <motion.path d={path("p05")} fill="none" stroke="rgba(245,248,194,0.12)" strokeWidth="0.5" strokeDasharray="3 3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }} />
      <motion.path d={path("p95")} fill="none" stroke="rgba(245,248,194,0.12)" strokeWidth="0.5" strokeDasharray="3 3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.2 }} />
      <motion.circle cx={sx(40)} cy={sy(pts[40].p50)} r="3" fill="#f5f8c2" animate={{ r: [3, 5, 3], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
    </svg>
  );
}

/* ─── Scanner Mini ─── */
function ScannerCard() {
  const assets = ["BTC", "ETH", "SOL", "SPY", "NVDA", "TSLA", "AAPL"];
  return (
    <div className="space-y-0 h-full flex flex-col">
      {assets.map((sym, i) => (
        <ScannerRow key={sym} symbol={sym} i={i} />
      ))}
    </div>
  );
}
function ScannerRow({ symbol, i }: { symbol: string; i: number }) {
  const d = useLiveAsset(symbol);
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between py-[5px] border-b border-border-dim/30 last:border-0 hover:bg-neon-green/[0.015] transition-colors px-1 group">
      <span className="font-mono text-[10px] font-bold text-text-primary group-hover:text-neon-green transition-colors w-[42px]">{symbol}</span>
      <span className="font-mono text-[10px] tabular-nums text-text-secondary w-[68px] text-right">${d.price < 1000 ? d.price.toFixed(1) : d.price.toLocaleString("en", { maximumFractionDigits: 0 })}</span>
      <span className={`font-mono text-[9px] tabular-nums font-bold w-[42px] text-right ${d.direction === "bullish" ? "text-bull" : "text-bear"}`}>{d.direction === "bullish" ? "▲" : "▼"}{(d.prob * 100).toFixed(0)}%</span>
      <div className="w-[36px] h-1 bg-bg-tertiary hidden sm:block"><motion.div className="h-full bg-neon-green/40" animate={{ width: `${d.vol}%` }} transition={{ duration: 0.4 }} /></div>
    </motion.div>
  );
}

/* ─── Heatmap Mini ─── */
function HeatmapCard() {
  const assets = ["BTC", "ETH", "SOL", "SPY", "NVDA"];
  const [data, setData] = useState<Record<string, { h1: number; h24: number }>>({});
  useEffect(() => {
    const gen = () => {
      const d: Record<string, { h1: number; h24: number }> = {};
      assets.forEach(a => { d[a] = { h1: 8 + Math.random() * 65, h24: 12 + Math.random() * 55 }; });
      setData(d);
    };
    gen(); const id = setInterval(gen, 3000); return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-6 gap-0.5 mb-1">
        <div />
        {assets.map(a => <div key={a} className="font-mono text-[7px] text-text-muted text-center">{a}</div>)}
      </div>
      {["1H", "24H"].map(h => (
        <div key={h} className="grid grid-cols-6 gap-0.5 mb-0.5">
          <div className="font-mono text-[7px] text-text-muted flex items-center">{h}</div>
          {assets.map(a => {
            const vol = data[a]?.[h === "1H" ? "h1" : "h24"] || 30;
            return (
              <motion.div
                key={`${a}-${h}`}
                className="aspect-[1.4] flex items-center justify-center border border-border-dim/20"
                style={{ backgroundColor: `rgba(245,248,194,${Math.min(vol / 100, 0.7) * 0.2})` }}
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2.5 + Math.random() * 2, repeat: Infinity }}
              >
                <span className="font-mono text-[9px] text-neon-green/80 tabular-nums font-bold">{vol.toFixed(0)}</span>
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─── Risk Panel ─── */
function RiskCard() {
  const [riskData, setRiskData] = useState([
    { label: "VAR 95%", value: -2340, fmt: "$" },
    { label: "CVAR 99%", value: -4120, fmt: "$" },
    { label: "KELLY", value: 4.2, fmt: "%" },
    { label: "SHARPE", value: 1.8, fmt: "" },
  ]);
  useEffect(() => {
    const id = setInterval(() => {
      setRiskData([
        { label: "VAR 95%", value: -(1800 + Math.random() * 1200), fmt: "$" },
        { label: "CVAR 99%", value: -(3000 + Math.random() * 2500), fmt: "$" },
        { label: "KELLY", value: 2 + Math.random() * 6, fmt: "%" },
        { label: "SHARPE", value: 0.8 + Math.random() * 2, fmt: "" },
      ]);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-full flex flex-col justify-between">
      {riskData.map(r => (
        <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-border-dim/30 last:border-0">
          <span className="font-mono text-[9px] text-text-muted tracking-wider">{r.label}</span>
          <motion.span
            className={`font-mono text-[12px] font-bold tabular-nums ${r.value < 0 ? "text-bear" : "text-neon-green"}`}
            key={r.value}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
          >
            {r.fmt === "$" ? (r.value < 0 ? "-" : "") + "$" + Math.abs(r.value).toLocaleString("en", { maximumFractionDigits: 0 }) : r.value.toFixed(1) + (r.fmt || "")}
          </motion.span>
        </div>
      ))}
    </div>
  );
}

/* ─── Smart Order ─── */
function SmartOrderCard() {
  const d = useLiveAsset("BTC");
  const entry = d.price;
  const sl = entry * 0.98;
  const tp = entry * 1.028;
  const rr = ((tp - entry) / (entry - sl)).toFixed(2);
  return (
    <div className="h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] font-bold text-text-primary">BTC LONG</span>
        <span className={`font-mono text-[8px] tracking-wider px-1.5 py-0.5 ${d.direction === "bullish" ? "text-bull bg-bull/10" : "text-bear bg-bear/10"}`}>{d.direction === "bullish" ? "BULLISH" : "BEARISH"}</span>
      </div>
      <div className="space-y-2 flex-1">
        {[
          { l: "ENTRY", v: `$${entry.toLocaleString("en", { maximumFractionDigits: 0 })}`, c: "text-text-primary" },
          { l: "STOP (P20)", v: `$${sl.toLocaleString("en", { maximumFractionDigits: 0 })}`, c: "text-bear" },
          { l: "TARGET (P80)", v: `$${tp.toLocaleString("en", { maximumFractionDigits: 0 })}`, c: "text-bull" },
          { l: "R:R RATIO", v: rr, c: "text-neon-green" },
        ].map(o => (
          <div key={o.l} className="flex justify-between items-center">
            <span className="font-mono text-[8px] text-text-muted tracking-wider">{o.l}</span>
            <span className={`font-mono text-[11px] font-bold tabular-nums ${o.c}`}>{o.v}</span>
          </div>
        ))}
      </div>
      <motion.div className="h-0.5 bg-neon-green/30 mt-2" animate={{ scaleX: [0, 1, 0] }} transition={{ duration: 3, repeat: Infinity }} style={{ transformOrigin: "left" }} />
    </div>
  );
}

/* ─── Portfolio ─── */
function PortfolioCard() {
  const positions = [
    { asset: "BTC", side: "LONG", size: "0.15 BTC", pnl: "+$892", color: "text-bull" },
    { asset: "ETH", side: "SHORT", size: "4.2 ETH", pnl: "-$134", color: "text-bear" },
    { asset: "SOL", side: "LONG", size: "85 SOL", pnl: "+$421", color: "text-bull" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <span className="font-mono text-[9px] text-text-muted tracking-wider">3 POSITIONS</span>
        <span className="font-mono text-[10px] text-bull font-bold tabular-nums">+$1,179</span>
      </div>
      <div className="space-y-1.5 flex-1">
        {positions.map(p => (
          <div key={p.asset} className="flex items-center justify-between py-1 px-2 border border-border-dim/30 hover:border-border-dim transition-colors">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-text-primary">{p.asset}</span>
              <span className={`font-mono text-[7px] tracking-wider px-1 py-0.5 ${p.side === "LONG" ? "text-bull/70 bg-bull/5" : "text-bear/70 bg-bear/5"}`}>{p.side}</span>
            </div>
            <motion.span className={`font-mono text-[10px] font-bold tabular-nums ${p.color}`} animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.5, repeat: Infinity }}>{p.pnl}</motion.span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Regime Indicator ─── */
function RegimeCard() {
  const [regime, setRegime] = useState(0);
  const regimes = [
    { name: "LOW VOL GRIND", color: "text-neon-green", bg: "bg-neon-green/10", desc: "Steady uptrend, low risk" },
    { name: "HIGH VOL TREND", color: "text-warning", bg: "bg-warning/10", desc: "Strong move, elevated risk" },
    { name: "MEAN REVERSION", color: "text-bull", bg: "bg-bull/10", desc: "Range-bound, fade extremes" },
    { name: "TAIL RISK", color: "text-bear", bg: "bg-bear/10", desc: "Danger zone, reduce size" },
  ];
  useEffect(() => { const id = setInterval(() => setRegime(r => (r + 1) % 4), 4000); return () => clearInterval(id); }, []);
  const r = regimes[regime];

  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <AnimatePresence mode="wait">
        <motion.div key={regime} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }} className="flex flex-col items-center">
          <div className={`px-3 py-1.5 ${r.bg} mb-2`}>
            <span className={`font-mono text-[11px] font-bold tracking-wider ${r.color}`}>[{r.name}]</span>
          </div>
          <span className="font-mono text-[9px] text-text-muted">{r.desc}</span>
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-1.5 mt-3">
        {regimes.map((_, i) => (
          <motion.div key={i} className={`w-1.5 h-1.5 transition-colors ${i === regime ? "bg-neon-green" : "bg-border-dim"}`} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  BENTO WRAPPER                                                  */
/* ═══════════════════════════════════════════════════════════════ */
function BentoCell({ children, label, badge, className = "", delay = 0 }: { children: React.ReactNode; label: string; badge?: string; className?: string; delay?: number }) {
  return (
    <FadeIn delay={delay} className={className}>
      <motion.div
        whileHover={{ borderColor: "rgba(245,248,194,0.15)" }}
        className="bg-bg-secondary border border-border-dim h-full flex flex-col overflow-hidden group"
      >
        <div className="px-3 py-2 border-b border-border-dim/50 flex items-center justify-between shrink-0">
          <span className="font-mono text-[9px] text-text-muted tracking-wider">{"// "}{label}</span>
          {badge && <motion.span className="font-mono text-[8px] text-neon-green tracking-wider" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>{badge}</motion.span>}
        </div>
        <div className="p-3 flex-1 min-h-0">{children}</div>
      </motion.div>
    </FadeIn>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  HERO TERMINAL — faithful replica of the real terminal          */
/* ═══════════════════════════════════════════════════════════════ */
function HeroTerminal() {
  const NAV = [
    { icon: "◈", label: "DASHBOARD", active: true },
    { icon: "●", label: "SIGNALS", active: false },
    { icon: "▦", label: "SCREENER", active: false },
    { icon: "◉", label: "ASSET DETAIL", active: false },
    { icon: "▲", label: "EARNINGS VOL", active: false },
    { icon: "⚠", label: "RISK MONITOR", active: false },
    { icon: "▣", label: "PORTFOLIO", active: false },
  ];

  return (
    <div className="bg-bg-primary border border-border-dim overflow-hidden max-h-[420px]">
      {/* ─ Header bar (matches terminal/layout.tsx) ─ */}
      <div className="h-8 flex items-center justify-between px-3 bg-bg-sidebar border-b border-border-dim">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-3"><div className="w-2.5 h-2.5 rounded-full bg-bear/30" /><div className="w-2.5 h-2.5 rounded-full bg-neutral/30" /><div className="w-2.5 h-2.5 rounded-full bg-bull/30" /></div>
          <span className="font-mono text-[10px] font-bold tracking-wider"><span className="text-neon-green">SYNTH</span><span className="text-text-primary">EDGE</span></span>
          <span className="font-mono text-[8px] text-text-muted tracking-wider ml-1 hidden sm:inline">TERMINAL</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-neon-green tracking-wider hidden sm:inline">SYNTH [CONNECTED]</span>
          <span className="text-border-dim hidden sm:inline text-[10px]">|</span>
          <div className="flex border border-border-dim">
            <span className="px-2 py-0.5 font-mono text-[9px] tracking-wider text-text-muted bg-bg-sidebar">1H</span>
            <span className="px-2 py-0.5 font-mono text-[9px] tracking-wider text-neon-green bg-neon-green/10 border-l border-border-dim">24H</span>
          </div>
        </div>
      </div>

      {/* ─ Ticker tape ─ */}
      <div className="h-6 overflow-hidden border-b border-border-dim bg-bg-sidebar flex items-center">
        <div className="flex ticker-scroll whitespace-nowrap">
          {[...ASSETS, ...ASSETS].map((a, i) => (
            <TickerItem key={`${a.symbol}-${i}`} symbol={a.symbol} />
          ))}
        </div>
      </div>

      {/* ─ Body: Sidebar + Content ─ */}
      <div className="flex" style={{ height: "calc(420px - 8px - 32px - 24px - 24px)" }}>
        {/* Sidebar */}
        <div className="w-36 bg-bg-sidebar border-r border-border-dim shrink-0 flex-col hidden sm:flex">
          <div className="px-3 py-2.5 border-b border-border-dim">
            <div className="font-mono text-[9px] tracking-widest text-neon-green font-bold">SYNTHEDGE</div>
            <div className="font-mono text-[7px] text-text-muted tracking-wider mt-0.5">PREDICTIVE INTELLIGENCE</div>
          </div>
          <div className="flex-1 py-1 overflow-hidden">
            {NAV.map(item => (
              <div key={item.label} className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[9px] tracking-wider border-l-2 ${
                item.active ? "border-l-neon-green bg-neon-green/5 text-neon-green" : "border-l-transparent text-text-muted"
              }`}>
                <span className="text-[10px] w-4 text-center">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-border-dim space-y-0.5">
            <div className="font-mono text-[7px] text-text-muted tracking-wider">{"// SYSTEM"}</div>
            <div className="font-mono text-[7px] text-text-muted tracking-wider flex justify-between"><span>STATUS</span><span className="text-neon-green">[ACTIVE]</span></div>
            <div className="font-mono text-[7px] text-text-muted tracking-wider flex justify-between"><span>POLLING</span><span>10s</span></div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 p-2.5 overflow-hidden bg-bg-primary space-y-2">
          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "BTC", value: "$67,482", change: "+0.6%", color: "text-bull" },
              { label: "ETH", value: "$3,847", change: "-0.3%", color: "text-bear" },
              { label: "SOL", value: "$178.4", change: "+1.2%", color: "text-bull" },
              { label: "NVDA", value: "$134.8", change: "+0.4%", color: "text-bull" },
            ].map(q => (
              <div key={q.label} className="bg-bg-secondary border border-border-dim/50 px-2 py-1.5">
                <div className="font-mono text-[7px] text-text-muted tracking-wider">{q.label}</div>
                <div className="font-mono text-[11px] font-bold text-text-primary tabular-nums">{q.value}</div>
                <div className={`font-mono text-[8px] tabular-nums ${q.color}`}>{q.change}</div>
              </div>
            ))}
          </div>

          {/* Scanner + Cone row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-1.5 flex-1 min-h-0">
            {/* Scanner table */}
            <div className="lg:col-span-3 bg-bg-secondary border border-border-dim/50 overflow-hidden">
              <div className="px-2.5 py-1.5 border-b border-border-dim/50 flex items-center justify-between">
                <span className="font-mono text-[8px] text-text-muted tracking-wider">{"// DIRECTIONAL SCANNER"}</span>
                <motion.span className="font-mono text-[7px] text-neon-green tracking-wider" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>[LIVE]</motion.span>
              </div>
              {/* Header row */}
              <div className="flex items-center justify-between px-2.5 py-1 border-b border-border-dim/30">
                <span className="font-mono text-[7px] text-text-muted w-[50px]">ASSET</span>
                <span className="font-mono text-[7px] text-text-muted w-[60px] text-right">PRICE</span>
                <span className="font-mono text-[7px] text-text-muted w-[40px] text-right">PROB</span>
                <span className="font-mono text-[7px] text-text-muted w-[50px] text-right hidden sm:block">VOL</span>
                <span className="font-mono text-[7px] text-text-muted w-[50px] text-right hidden sm:block">REGIME</span>
              </div>
              {ASSETS.map((a, i) => <HeroScannerRow key={a.symbol} asset={a} i={i} />)}
            </div>

            {/* Probability Cone */}
            <div className="lg:col-span-2 bg-bg-secondary border border-border-dim/50 flex flex-col">
              <div className="px-2.5 py-1.5 border-b border-border-dim/50 flex items-center justify-between">
                <span className="font-mono text-[8px] text-text-muted tracking-wider">{"// PROBABILITY CONE"} — <span className="text-neon-green">BTC</span></span>
                <span className="font-mono text-[7px] text-text-muted tracking-wider">[D3.JS]</span>
              </div>
              <div className="flex-1 p-2 min-h-[120px]"><ConeCard /></div>
              <div className="px-2.5 py-1 border-t border-border-dim/30 flex justify-between">
                <span className="font-mono text-[7px] text-text-muted">P5 — P50 — P95</span>
                <span className="font-mono text-[7px] text-text-muted">24H</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─ Status bar ─ */}
      <div className="h-5 flex items-center justify-between px-3 bg-bg-sidebar border-t border-border-dim">
        <div className="flex items-center gap-3 font-mono text-[8px] tracking-wider">
          <span className="text-neon-green">● SYNTH_API</span>
          <span className="text-text-muted">HORIZON: 24H</span>
        </div>
        <span className="font-mono text-[8px] text-text-muted tracking-wider">UTC 14:32:07</span>
      </div>
    </div>
  );
}

function TickerItem({ symbol }: { symbol: string }) {
  const d = useLiveAsset(symbol);
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 border-r border-border-dim/30">
      <span className="font-mono text-[8px] text-text-muted tracking-wider">{symbol}</span>
      <span className="font-mono text-[9px] tabular-nums text-text-primary">${d.price < 1000 ? d.price.toFixed(1) : d.price.toLocaleString("en", { maximumFractionDigits: 0 })}</span>
      <span className={`font-mono text-[7px] ${d.direction === "bullish" ? "text-bull" : "text-bear"}`}>{d.direction === "bullish" ? "▲" : "▼"}</span>
    </div>
  );
}

function HeroScannerRow({ asset, i }: { asset: typeof ASSETS[number]; i: number }) {
  const d = useLiveAsset(asset.symbol);
  const regimes = ["LOW VOL", "TREND", "REVERT", "TAIL"];
  const regime = regimes[Math.floor(d.vol / 20) % 4];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.04 }} className="flex items-center justify-between px-2.5 py-[3px] border-b border-border-dim/20 last:border-0 hover:bg-neon-green/[0.01] transition-colors">
      <div className="flex items-center gap-1.5 w-[50px]">
        <span className="font-mono text-[9px] font-bold text-text-primary">{asset.symbol}</span>
      </div>
      <span className="font-mono text-[9px] tabular-nums text-text-secondary w-[60px] text-right">${d.price < 1000 ? d.price.toFixed(1) : d.price.toLocaleString("en", { maximumFractionDigits: 0 })}</span>
      <span className={`font-mono text-[8px] tabular-nums font-bold w-[40px] text-right ${d.direction === "bullish" ? "text-bull" : "text-bear"}`}>{d.direction === "bullish" ? "▲" : "▼"}{(d.prob * 100).toFixed(0)}%</span>
      <div className="w-[50px] hidden sm:flex items-center gap-1 justify-end">
        <div className="h-1 w-6 bg-bg-tertiary"><motion.div className="h-full bg-neon-green/40" animate={{ width: `${d.vol}%` }} transition={{ duration: 0.4 }} /></div>
        <span className="font-mono text-[7px] tabular-nums text-text-muted">{d.vol.toFixed(0)}%</span>
      </div>
      <span className="font-mono text-[7px] text-neon-green/50 tracking-wider w-[50px] text-right hidden sm:block">{regime}</span>
    </motion.div>
  );
}

/* ─── Distribution Bell Curve ─── */
function DistributionCard() {
  const [skew, setSkew] = useState(0.3);
  useEffect(() => { const id = setInterval(() => setSkew(-0.5 + Math.random()), 3500); return () => clearInterval(id); }, []);

  const w = 200, h = 80, pts = 60;
  const path = useMemo(() => {
    const points = [];
    for (let i = 0; i <= pts; i++) {
      const x = (i / pts) * w;
      const t = (i / pts - 0.5 - skew * 0.15) * 6;
      const y = h - Math.exp(-t * t / 2) * h * 0.85 - 4;
      points.push(`${i === 0 ? "M" : "L"}${x},${y}`);
    }
    return points.join(" ");
  }, [skew]);

  const areaPath = useMemo(() => `${path} L${w},${h} L0,${h} Z`, [path]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none">
          <motion.path d={areaPath} fill="rgba(245,248,194,0.06)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
          <motion.path d={path} fill="none" stroke="#f5f8c2" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
          {/* Median line */}
          <line x1={w * (0.5 + skew * 0.15)} y1={0} x2={w * (0.5 + skew * 0.15)} y2={h} stroke="rgba(245,248,194,0.15)" strokeWidth="0.5" strokeDasharray="3 2" />
        </svg>
      </div>
      <div className="flex justify-between items-center mt-1">
        <span className="font-mono text-[8px] text-text-muted">P5</span>
        <span className={`font-mono text-[9px] font-bold ${skew > 0.1 ? "text-bull" : skew < -0.1 ? "text-bear" : "text-text-secondary"}`}>
          SKEW: {skew > 0.1 ? "BULLISH" : skew < -0.1 ? "BEARISH" : "NEUTRAL"}
        </span>
        <span className="font-mono text-[8px] text-text-muted">P95</span>
      </div>
    </div>
  );
}

/* ─── Live Signals Feed ─── */
function SignalsFeed() {
  const signalPool = useMemo(() => [
    { asset: "BTC", type: "DIRECTION", msg: "Bullish 62% — above median", color: "text-bull" },
    { asset: "ETH", type: "VOL SPIKE", msg: "Implied vol jumped to 48%", color: "text-warning" },
    { asset: "SOL", type: "REGIME", msg: "Shifted to HIGH VOL TREND", color: "text-warning" },
    { asset: "NVDA", type: "CONFLUENCE", msg: "3/3 signals bullish", color: "text-bull" },
    { asset: "SPY", type: "TAIL RISK", msg: "P5 tail widening — hedge", color: "text-bear" },
    { asset: "TSLA", type: "DIRECTION", msg: "Bearish 58% — below median", color: "text-bear" },
    { asset: "XAU", type: "LOW VOL", msg: "Grinding up, vol compressing", color: "text-neon-green" },
    { asset: "BTC", type: "SKEW", msg: "Positive skew +0.18 — upside fat tail", color: "text-bull" },
    { asset: "AAPL", type: "DIRECTION", msg: "Bullish 54% — slight edge", color: "text-bull" },
    { asset: "GOOGL", type: "REGIME", msg: "Mean reversion zone — fade moves", color: "text-neon-green" },
    { asset: "ETH", type: "CONFLUENCE", msg: "Vol + direction aligned bearish", color: "text-bear" },
    { asset: "SOL", type: "DIRECTION", msg: "Bullish 67% — strong conviction", color: "text-bull" },
  ], []);

  const [signals, setSignals] = useState<typeof signalPool>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize with 4 random signals
    const initial = Array.from({ length: 4 }, () => signalPool[Math.floor(Math.random() * signalPool.length)]);
    setSignals(initial);

    const id = setInterval(() => {
      const next = signalPool[Math.floor(Math.random() * signalPool.length)];
      setSignals(prev => [next, ...prev].slice(0, 6));
    }, 2500);
    return () => clearInterval(id);
  }, [signalPool]);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [signals]);

  return (
    <div ref={containerRef} className="h-full overflow-hidden space-y-1">
      <AnimatePresence initial={false}>
        {signals.map((s, i) => (
          <motion.div
            key={`${s.asset}-${s.type}-${i}`}
            initial={{ opacity: 0, x: -12, height: 0 }}
            animate={{ opacity: 1, x: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2 px-1 py-1 border-b border-border-dim/20"
          >
            <span className="font-mono text-[9px] font-bold text-text-primary w-[36px] shrink-0">{s.asset}</span>
            <span className="font-mono text-[7px] tracking-wider px-1.5 py-0.5 bg-bg-tertiary text-text-muted shrink-0">{s.type}</span>
            <span className={`font-mono text-[9px] ${s.color} truncate`}>{s.msg}</span>
            <motion.div className="w-1.5 h-1.5 rounded-full bg-neon-green/50 shrink-0 ml-auto" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sparkline Grid ─── */
function SparklineGrid() {
  const assets = ["BTC", "ETH", "SOL", "SPY", "NVDA", "TSLA"];
  return (
    <div className="h-full grid grid-cols-3 sm:grid-cols-6 gap-2">
      {assets.map(sym => <Sparkline key={sym} symbol={sym} />)}
    </div>
  );
}

function Sparkline({ symbol }: { symbol: string }) {
  const [points, setPoints] = useState<number[]>([]);
  const d = useLiveAsset(symbol);

  useEffect(() => {
    // Generate 24 random walk points
    const gen = () => {
      const pts = [0];
      for (let i = 1; i < 24; i++) pts.push(pts[i - 1] + (Math.random() - 0.48) * 2);
      setPoints(pts);
    };
    gen(); const id = setInterval(gen, 4000); return () => clearInterval(id);
  }, []);

  if (!points.length) return null;
  const w = 80, h = 32;
  const mn = Math.min(...points), mx = Math.max(...points);
  const range = mx - mn || 1;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i / 23) * w},${h - ((p - mn) / range) * h}`).join(" ");
  const up = points[points.length - 1] > points[0];

  return (
    <div className="flex flex-col items-center justify-between h-full py-1">
      <div className="flex items-center justify-between w-full">
        <span className="font-mono text-[9px] font-bold text-text-primary">{symbol}</span>
        <span className={`font-mono text-[8px] font-bold ${up ? "text-bull" : "text-bear"}`}>{up ? "▲" : "▼"}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full flex-1" preserveAspectRatio="none">
        <motion.path d={path} fill="none" stroke={up ? "#4ade80" : "#ff3366"} strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
      </svg>
      <span className="font-mono text-[8px] tabular-nums text-text-muted">${d.price < 1000 ? d.price.toFixed(0) : (d.price / 1000).toFixed(1) + "k"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  LANDING PAGE                                                   */
/* ═══════════════════════════════════════════════════════════════ */

const ASSETS = [
  { symbol: "BTC", name: "Bitcoin", type: "CRYPTO" },
  { symbol: "ETH", name: "Ethereum", type: "CRYPTO" },
  { symbol: "SOL", name: "Solana", type: "CRYPTO" },
  { symbol: "SPY", name: "S&P 500", type: "EQUITY" },
  { symbol: "NVDA", name: "NVIDIA", type: "EQUITY" },
  { symbol: "TSLA", name: "Tesla", type: "EQUITY" },
  { symbol: "AAPL", name: "Apple", type: "EQUITY" },
  { symbol: "GOOGL", name: "Alphabet", type: "EQUITY" },
  { symbol: "XAU", name: "Gold", type: "COMMODITY" },
];

// Resolve app URL: in production use app subdomain, in dev use /terminal
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "/terminal";

export default function LandingPage() {
  const router = useRouter();
  const setSynthApiKey = useSettingsStore((s) => s.setSynthApiKey);
  const setHlAddress = useSettingsStore((s) => s.setHlAddress);
  const existingKey = useSettingsStore((s) => s.synthApiKey);
  const [apiKey, setApiKey] = useState(existingKey);
  const [address, setAddress] = useState("");

  const goToApp = (path = "") => {
    const base = APP_URL;
    if (base.startsWith("http")) {
      window.location.href = `${base}${path}`;
    } else {
      router.push(`${base}${path}`);
    }
  };

  const handleLaunch = () => {
    if (apiKey) setSynthApiKey(apiKey);
    if (address) setHlAddress(address);
    goToApp();
  };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  // Parallax for hero
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <div className="min-h-screen bg-bg-primary relative">

      {/* ─── NAV ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-sidebar/80 backdrop-blur-md border-b border-border-dim">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-11 flex items-center justify-between">
          <div className="font-mono text-sm font-bold tracking-wider">
            <span className="text-neon-green">SYNTH</span><span className="text-text-primary">EDGE</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#product" className="font-mono text-[10px] text-text-muted tracking-wider hover:text-text-secondary transition-colors hidden sm:block">PRODUCT</a>
            <a href="#assets" className="font-mono text-[10px] text-text-muted tracking-wider hover:text-text-secondary transition-colors hidden sm:block">ASSETS</a>
            <a href="https://synthdata.co" target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-text-muted tracking-wider hover:text-text-secondary transition-colors hidden sm:block">SYNTHDATA</a>
            <a href="https://x.com/synthedge_xyz" target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-text-muted tracking-wider hover:text-text-secondary transition-colors hidden sm:block">𝕏</a>
            <button onClick={() => scrollTo("get-started")} className="px-4 py-1.5 bg-neon-green/10 text-neon-green border border-neon-green/30 font-mono text-[10px] font-bold tracking-widest hover:bg-neon-green/20 transition-all">
              LAUNCH
            </button>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="min-h-screen flex items-center px-4 pt-11 relative overflow-hidden">
        {/* Flow field bg */}
        <FlowField />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-neon-green/[0.012] rounded-full blur-[200px]" />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative max-w-6xl mx-auto w-full">
          {/* Text + CTA */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center max-w-2xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-neon-green/20 bg-neon-green/[0.05] mb-6 hover:bg-neon-green/[0.08] transition-colors cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              <span className="font-mono text-[10px] text-neon-green/90 font-medium tracking-wider">SYNTH HACKATHON 2026 WINNER</span>
              <span className="font-mono text-[10px] text-text-muted tracking-wider hidden sm:inline">· Best Equities App</span>
            </motion.div>
            <h1 className="font-mono text-4xl sm:text-5xl lg:text-[64px] font-bold tracking-wider leading-[0.95]">
              <GlitchText text="SYNTH" className="text-neon-green" />
              <GlitchText text="EDGE" className="text-text-primary" />
            </h1>

            <p className="mt-5 font-mono text-[13px] text-text-secondary leading-relaxed max-w-lg mx-auto">
              The trading terminal that shows you <span className="text-neon-green">where prices are probably going</span> — not where some influencer thinks they&apos;re going.
            </p>

            <div className="mt-8 flex gap-3 justify-center">
              <motion.button onClick={() => scrollTo("get-started")} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-7 py-3 bg-neon-green/10 text-neon-green border border-neon-green/30 font-mono text-[11px] font-bold tracking-widest hover:bg-neon-green/20 transition-all">
                GET STARTED
              </motion.button>
              <motion.button onClick={() => goToApp()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-7 py-3 bg-bg-secondary text-text-secondary border border-border-dim font-mono text-[11px] font-bold tracking-widest hover:text-text-primary hover:border-text-muted transition-all">
                TRY DEMO
              </motion.button>
            </div>

            <div className="mt-8 flex gap-10 justify-center">
              {[
                { v: 9, l: "ASSETS" },
                { v: 9, l: "PERCENTILES" },
                { v: 2, l: "HORIZONS" },
              ].map(s => (
                <div key={s.l}>
                  <div className="font-mono text-xl font-bold text-neon-green"><Counter value={s.v} /></div>
                  <div className="font-mono text-[8px] text-text-muted tracking-wider">{s.l}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Full-width Terminal Mockup */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="mt-12 relative">
            <div className="absolute -inset-6 bg-neon-green/[0.015] blur-2xl rounded-sm" />
            <div className="relative">
              <HeroTerminal />
            </div>
          </motion.div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 2, repeat: Infinity }} className="font-mono text-[8px] text-text-muted tracking-wider flex flex-col items-center gap-1 cursor-pointer" onClick={() => scrollTo("product")}>
            <span>SCROLL</span><span>▼</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ BENTO GRID — PRODUCT ═══ */}
      <section id="product" className="py-16 px-4 sm:px-6 border-t border-border-dim">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-mono text-[10px] text-text-muted tracking-wider mb-1"><TextScramble text="// PRODUCT" delay={0.1} /></div>
                <h2 className="font-mono text-xl sm:text-2xl font-bold tracking-wider">
                  <TextScramble text="EVERYTHING IN " delay={0.2} /><TextScramble text="ONE TERMINAL" className="text-neon-green" delay={0.3} />
                </h2>
              </div>
              <motion.button onClick={() => goToApp()} whileHover={{ scale: 1.02 }} className="hidden sm:block px-4 py-1.5 border border-border-dim font-mono text-[10px] text-text-muted tracking-wider hover:text-neon-green hover:border-neon-green/30 transition-all">
                TRY IT →
              </motion.button>
            </div>
            <p className="font-mono text-[11px] text-text-muted leading-relaxed max-w-2xl mb-8">
              SynthEdge pulls <span className="text-text-secondary">AI probability forecasts</span> from SynthData and turns them into volatility maps, directional signals, risk metrics, and smart order levels — all updating in real time. Every card below is a live preview of what you get inside the terminal.
            </p>
          </FadeIn>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-[180px]">
            {/* Probability Cone — large */}
            <BentoCell label="PROBABILITY CONE" badge="[LIVE]" className="sm:col-span-2 sm:row-span-1" delay={0.05}>
              <div className="h-full"><ConeCard /></div>
            </BentoCell>

            {/* Scanner — tall */}
            <BentoCell label="DIRECTIONAL SCANNER" badge="[LIVE]" className="sm:row-span-2" delay={0.1}>
              <ScannerCard />
            </BentoCell>

            {/* Regime */}
            <BentoCell label="REGIME DETECTION" delay={0.15}>
              <RegimeCard />
            </BentoCell>

            {/* Heatmap */}
            <BentoCell label="VOL HEATMAP" badge="[1H/24H]" delay={0.2}>
              <HeatmapCard />
            </BentoCell>

            {/* Risk */}
            <BentoCell label="RISK METRICS" badge="[LIVE]" delay={0.25}>
              <RiskCard />
            </BentoCell>

            {/* Distribution Shape */}
            <BentoCell label="DISTRIBUTION" badge="[BTC]" delay={0.28}>
              <DistributionCard />
            </BentoCell>

            {/* Live Signals Feed */}
            <BentoCell label="LIVE SIGNALS" badge="[FEED]" className="sm:col-span-2" delay={0.3}>
              <SignalsFeed />
            </BentoCell>

            {/* Smart Orders */}
            <BentoCell label="SMART ORDERS" badge="[AI]" delay={0.35}>
              <SmartOrderCard />
            </BentoCell>

            {/* Portfolio */}
            <BentoCell label="PORTFOLIO" delay={0.38}>
              <PortfolioCard />
            </BentoCell>

          </div>
        </div>
      </section>

      {/* ═══ ASSETS — INTERACTIVE GRID ═══ */}
      <section id="assets" className="py-16 px-4 sm:px-6 bg-bg-secondary border-t border-border-dim relative overflow-hidden">
        <TopoField />
        <div className="max-w-6xl mx-auto relative">
          <FadeIn>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-mono text-[10px] text-text-muted tracking-wider mb-1"><TextScramble text="// COVERAGE" delay={0.1} /></div>
                <h2 className="font-mono text-xl sm:text-2xl font-bold tracking-wider">
                  <TextScramble text="9 ASSETS" className="text-neon-green" delay={0.2} /><TextScramble text=" — HOVER TO EXPLORE" delay={0.3} />
                </h2>
              </div>
              <div className="hidden sm:flex gap-4">
                {["CRYPTO", "EQUITY", "COMMODITY"].map(t => (
                  <span key={t} className={`font-mono text-[9px] tracking-wider px-2 py-0.5 ${
                    t === "CRYPTO" ? "text-neon-green/60 bg-neon-green/5" : t === "EQUITY" ? "text-bull/60 bg-bull/5" : "text-neutral/60 bg-neutral/5"
                  }`}>{t}</span>
                ))}
              </div>
            </div>
            <p className="font-mono text-[11px] text-text-muted leading-relaxed max-w-2xl mb-8">
              Crypto, US equities, and gold — all covered by the same AI forecasting model. Each asset gets its own probability distribution updated every minute, so you&apos;re always looking at the freshest data.
            </p>
          </FadeIn>

          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-9 gap-2">
            {ASSETS.map((a, i) => <AssetCardHover key={a.symbol} asset={a} i={i} />)}
          </div>
        </div>
      </section>

      {/* ═══ SYNTHDATA + HOW IT WORKS — SIDE BY SIDE ═══ */}
      <section className="py-16 px-4 sm:px-6 border-t border-border-dim">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SynthData */}
          <FadeIn>
            <div className="bg-bg-secondary border border-border-dim p-6 h-full">
              <div className="font-mono text-[10px] text-text-muted tracking-wider mb-3"><TextScramble text="// DATA SOURCE" delay={0.1} /></div>
              <h3 className="font-mono text-lg font-bold tracking-wider mb-2">
                <TextScramble text="POWERED BY " delay={0.2} /><TextScramble text="SYNTHDATA" className="text-neon-green" delay={0.3} />
              </h3>
              <p className="font-mono text-[10px] text-text-muted leading-relaxed mb-4">
                Instead of a single price target, SynthData&apos;s AI gives you the full picture — 9 probability levels showing best case, worst case, and everything in between. We derive all our analytics from these distributions.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { v: "9", l: "PERCENTILES" },
                  { v: "2", l: "HORIZONS" },
                  { v: "AI", l: "ML MODELS" },
                ].map(s => (
                  <div key={s.l} className="text-center border border-border-dim/50 py-3">
                    <div className="font-mono text-lg font-bold text-neon-green">{s.v}</div>
                    <div className="font-mono text-[8px] text-text-muted tracking-wider">{s.l}</div>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[11px] text-text-muted leading-relaxed mb-4">
                SynthData generates <span className="text-text-secondary">probabilistic price forecasts</span> — not single predictions, but a full distribution of where prices could go.
              </p>
              <a href="https://synthdata.co" target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-neon-green/70 tracking-wider hover:text-neon-green transition-colors">
                SYNTHDATA.CO →
              </a>
            </div>
          </FadeIn>

          {/* How it works */}
          <FadeIn delay={0.1}>
            <div className="bg-bg-secondary border border-border-dim p-6 h-full">
              <div className="font-mono text-[10px] text-text-muted tracking-wider mb-3"><TextScramble text="// WORKFLOW" delay={0.1} /></div>
              <h3 className="font-mono text-lg font-bold tracking-wider mb-2">
                <TextScramble text="HOW IT " delay={0.2} /><TextScramble text="WORKS" className="text-neon-green" delay={0.3} />
              </h3>
              <p className="font-mono text-[10px] text-text-muted leading-relaxed mb-4">
                From API key to trade execution in under a minute. No complex setup — just connect and go.
              </p>
              <div className="space-y-4">
                {[
                  { n: "01", t: "CONNECT", d: "Add your free SynthData API key", icon: "→" },
                  { n: "02", t: "ANALYZE", d: "AI fetches probability distributions", icon: "◇" },
                  { n: "03", t: "DECIDE", d: "Explore cones, scanners, heatmaps", icon: "○" },
                  { n: "04", t: "EXECUTE", d: "Trade on Hyperliquid with smart orders", icon: "△" },
                ].map((step, i) => (
                  <motion.div key={step.n} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }} className="flex items-center gap-4 group">
                    <div className="w-8 h-8 flex items-center justify-center border border-border-dim group-hover:border-neon-green/30 transition-colors shrink-0 leading-none">
                      <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors leading-none">{step.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] text-neon-green/40">{step.n}</span>
                        <span className="font-mono text-[11px] text-neon-green tracking-wider font-bold">{step.t}</span>
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">{step.d}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ GET STARTED ═══ */}
      <section id="get-started" className="py-16 px-4 sm:px-6 bg-bg-secondary border-t border-border-dim">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left — form */}
          <FadeIn>
            <div className="bg-bg-primary border border-border-dim p-6 sm:p-8">
              <div className="mb-2 font-mono text-[10px] text-text-muted tracking-wider">{"// INITIALIZE TERMINAL"}</div>
              <p className="font-mono text-[10px] text-text-muted leading-relaxed mb-4">
                Grab a free API key from SynthData, paste it below, and you&apos;re in. Add a Hyperliquid address to see your portfolio — read-only, no private keys ever touch our servers.
              </p>
              <div className="space-y-5">
                <div>
                  <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">SYNTH_API_KEY</label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Enter your Synth API key" className="w-full bg-bg-tertiary border border-border-dim px-4 py-3 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/30 transition-all" />
                  <p className="font-mono text-[9px] text-text-muted mt-1 tracking-wider">FREE AT <a href="https://dashboard.synthdata.co" target="_blank" rel="noopener noreferrer" className="text-neon-green/70 hover:text-neon-green">DASHBOARD.SYNTHDATA.CO</a></p>
                </div>
                <div>
                  <label className="block font-mono text-[10px] text-text-muted uppercase tracking-wider mb-2">HYPERLIQUID_ADDRESS <span className="text-text-muted">(OPTIONAL)</span></label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="0x..." className="w-full bg-bg-tertiary border border-border-dim px-4 py-3 font-mono text-[11px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/30 transition-all" />
                  <p className="font-mono text-[9px] text-text-muted mt-1 tracking-wider">READ-ONLY. NO PRIVATE KEYS.</p>
                </div>
                <motion.button onClick={handleLaunch} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full py-3 bg-neon-green/10 text-neon-green border border-neon-green/30 font-mono text-[11px] font-bold uppercase tracking-widest hover:bg-neon-green/20 transition-all">
                  [LAUNCH TERMINAL]
                </motion.button>
                <button onClick={() => goToApp()} className="w-full py-2 text-text-muted font-mono text-[10px] uppercase tracking-wider hover:text-text-secondary transition-colors">
                  SKIP — USE DEMO DATA
                </button>
              </div>
            </div>
          </FadeIn>

          {/* Right — terminal preview */}
          <FadeIn delay={0.15}>
            <div className="hidden lg:block">
              <div className="bg-bg-secondary border border-border-dim overflow-hidden">
                <div className="px-3 py-2 border-b border-border-dim/50 flex items-center justify-between">
                  <span className="font-mono text-[9px] text-text-muted tracking-wider">{"// PROBABILITY CONE"} — <span className="text-neon-green">BTC</span></span>
                  <motion.span className="font-mono text-[8px] text-neon-green tracking-wider" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}>[LIVE]</motion.span>
                </div>
                <div className="p-3 h-[200px]"><ConeCard /></div>
              </div>
              <div className="mt-4 text-center">
                <span className="font-mono text-[9px] text-text-muted tracking-wider">LIVE TERMINAL PREVIEW</span>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border-dim bg-bg-sidebar py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-6">
            <div className="font-mono text-sm font-bold tracking-wider"><span className="text-neon-green">SYNTH</span><span className="text-text-primary">EDGE</span></div>
            <div className="hidden sm:flex gap-4">
              <a href="https://synthdata.co" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] text-text-muted tracking-wider hover:text-neon-green transition-colors">SYNTHDATA</a>
              <a href="https://hyperliquid.xyz" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] text-text-muted tracking-wider hover:text-neon-green transition-colors">HYPERLIQUID</a>
              <a href="https://github.com/londrwus/SynthEdge" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] text-text-muted tracking-wider hover:text-neon-green transition-colors">GITHUB</a>
              <a href="https://x.com/synthedge_xyz" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] text-text-muted tracking-wider hover:text-neon-green transition-colors">TWITTER</a>
            </div>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="font-mono text-[8px] text-text-muted tracking-wider">NOT FINANCIAL ADVICE · TRADING INVOLVES RISK</p>
            <p className="font-mono text-[8px] text-text-muted tracking-wider">
              Powered by <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="text-neon-green/50 hover:text-neon-green">TradingView</a> · <a href="https://synthdata.co" target="_blank" rel="noopener noreferrer" className="text-neon-green/50 hover:text-neon-green">SynthData</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Asset card with hover expand ─── */
function AssetCardHover({ asset, i }: { asset: typeof ASSETS[number]; i: number }) {
  const [hovered, setHovered] = useState(false);
  const d = useLiveAsset(asset.symbol);
  return (
    <FadeIn delay={i * 0.04}>
      <motion.div
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        whileHover={{ scale: 1.04 }}
        className="bg-bg-primary border border-border-dim p-3 cursor-default relative overflow-hidden"
      >
        <motion.div className="absolute top-0 left-0 h-px bg-neon-green" initial={{ width: "0%" }} animate={{ width: hovered ? "100%" : "0%" }} transition={{ duration: 0.25 }} />
        <div className="text-center">
          <div className="font-mono text-base font-bold text-text-primary">{asset.symbol}</div>
          <div className="font-mono text-[8px] text-text-muted mt-0.5">{asset.name}</div>
          <div className={`font-mono text-[7px] tracking-wider mt-1 px-1 py-0.5 inline-block ${asset.type === "CRYPTO" ? "text-neon-green/60 bg-neon-green/5" : asset.type === "EQUITY" ? "text-bull/60 bg-bull/5" : "text-neutral/60 bg-neutral/5"}`}>{asset.type}</div>
        </div>
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
              <div className="mt-2 pt-2 border-t border-border-dim/30 text-center space-y-1">
                <div className="font-mono text-[10px] tabular-nums text-text-primary">${d.price < 1000 ? d.price.toFixed(2) : d.price.toLocaleString("en", { maximumFractionDigits: 0 })}</div>
                <div className={`font-mono text-[9px] font-bold ${d.direction === "bullish" ? "text-bull" : "text-bear"}`}>{d.direction === "bullish" ? "▲" : "▼"} {(d.prob * 100).toFixed(0)}%</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </FadeIn>
  );
}
