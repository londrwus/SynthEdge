"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { cn } from "@/lib/utils";
import { TickerTape } from "@/components/ticker-tape";
import { WalletConnect } from "@/components/wallet-connect";

/* ═══════════════════════════════════════════════════════════════ */
/*  BOOT SEQUENCE                                                  */
/* ═══════════════════════════════════════════════════════════════ */

const BOOT_LINES = [
  { text: "SynthEdge Terminal v0.1.1", tag: "INIT", delay: 0 },
  { text: "Loading kernel modules...", tag: "SYS", delay: 150 },
  { text: "Probability engine initialized", tag: "OK", delay: 350 },
  { text: "Connecting to Synth API...", tag: "NET", delay: 550 },
  { text: "API handshake complete", tag: "OK", delay: 800 },
  { text: "Market scanner online — 9 assets", tag: "OK", delay: 1000 },
  { text: "Risk engine loaded", tag: "OK", delay: 1150 },
  { text: "TradingView charts ready", tag: "OK", delay: 1300 },
  { text: "All systems nominal", tag: "RDY", delay: 1500 },
];

function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"boot" | "wipe" | "done">("boot");
  const [scanY, setScanY] = useState(0);

  useEffect(() => {
    // Show lines one by one
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => setVisibleLines(i + 1), line.delay);
    });

    // Progress bar fills over the boot duration
    const start = Date.now();
    const duration = 1500;
    const pId = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(elapsed / duration, 1);
      setProgress(p);
      if (p >= 1) clearInterval(pId);
    }, 16);

    // After last line, start wipe
    setTimeout(() => setPhase("wipe"), 1800);

    return () => clearInterval(pId);
  }, []);

  // Scanline wipe animation
  useEffect(() => {
    if (phase !== "wipe") return;
    let y = 0;
    const id = setInterval(() => {
      y += 6;
      setScanY(y);
      if (y > 110) {
        clearInterval(id);
        setPhase("done");
        onComplete();
      }
    }, 8);
    return () => clearInterval(id);
  }, [phase, onComplete]);

  if (phase === "done") return null;

  return (
    <div className="fixed inset-0 z-[100] bg-bg-primary flex items-center justify-center">
      {/* Scanline wipe overlay */}
      {phase === "wipe" && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, transparent ${scanY - 3}%, rgba(245,248,194,0.15) ${scanY}%, transparent ${scanY + 3}%)`,
          }}
        />
      )}
      {/* Content fades out during wipe */}
      <div
        className="w-full max-w-lg px-6 transition-opacity duration-300"
        style={{ opacity: phase === "wipe" ? Math.max(0, 1 - scanY / 80) : 1 }}
      >
        {/* Logo */}
        <div className="font-mono text-sm font-bold tracking-wider mb-6">
          <span className="text-neon-green">SYNTH</span>
          <span className="text-text-primary">EDGE</span>
          <span className="text-text-muted text-[10px] ml-2 tracking-wider">TERMINAL</span>
        </div>

        {/* Boot lines */}
        <div className="space-y-1 mb-6 font-mono text-[11px]">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className={cn(
                "shrink-0 tracking-wider",
                line.tag === "OK" || line.tag === "RDY" ? "text-neon-green" :
                line.tag === "NET" ? "text-bull" :
                "text-text-muted"
              )}>
                [{line.tag}]
              </span>
              <span className="text-text-secondary">{line.text}</span>
              {i === visibleLines - 1 && phase === "boot" && (
                <span className="text-neon-green animate-pulse">█</span>
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-px bg-border-dim relative overflow-hidden">
          <div
            className="h-full bg-neon-green transition-all duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 font-mono text-[9px] text-text-muted tracking-wider">
          <span>INITIALIZING</span>
          <span>{Math.floor(progress * 100)}%</span>
        </div>
      </div>

      {/* CRT scanline effect */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(245,248,194,0.5) 2px, rgba(245,248,194,0.5) 4px)",
        }}
      />
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/terminal", icon: "\u25C8", label: "DASHBOARD" },
  { href: "/terminal/signals", icon: "\u25CF", label: "SIGNALS" },
  { href: "/terminal/screener", icon: "\u25A6", label: "SCREENER" },
  { href: "/terminal/asset/BTC", icon: "\u25C9", label: "ASSET DETAIL" },
  { href: "/terminal/earnings", icon: "\u25B2", label: "EARNINGS VOL" },
  { href: "/terminal/risk", icon: "\u26A0", label: "RISK MONITOR" },
  { href: "/terminal/portfolio", icon: "\u25A3", label: "PORTFOLIO" },
  { href: "/terminal/faq", icon: "?", label: "HELP / FAQ" },
  { href: "/terminal/settings", icon: "\u2699", label: "SETTINGS" },
];

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const horizon = useSettingsStore((s) => s.horizon);
  const setHorizon = useSettingsStore((s) => s.setHorizon);
  const synthApiKey = useSettingsStore((s) => s.synthApiKey);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const alreadyBooted = typeof window !== "undefined" && sessionStorage.getItem("synthedge_booted") === "1";
  const [booted, setBooted] = useState(alreadyBooted);
  const [showBoot, setShowBoot] = useState(!alreadyBooted);
  const handleBootComplete = useCallback(() => {
    setShowBoot(false);
    setBooted(true);
    sessionStorage.setItem("synthedge_booted", "1");
  }, []);

  // Close sidebar on route change — use ref to avoid lint warning about setState in effect
  const pathnameRef = useRef(pathname);
  if (pathnameRef.current !== pathname) {
    pathnameRef.current = pathname;
    if (sidebarOpen) setSidebarOpen(false);
  }

  // Close sidebar on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <>
    {showBoot && <BootSequence onComplete={handleBootComplete} />}
    <div className={cn("h-screen flex flex-col bg-bg-primary overflow-hidden transition-opacity duration-500", booted ? "opacity-100" : "opacity-0")}>
      {/* Header */}
      <header className="h-10 flex items-center justify-between px-3 sm:px-4 bg-bg-sidebar border-b border-border-dim shrink-0">
        <div className="flex items-center gap-2">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden font-mono text-text-secondary hover:text-neon-green transition-colors p-1"
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              {sidebarOpen ? (
                <path d="M4 4L14 14M14 4L4 14" />
              ) : (
                <path d="M2 4h14M2 9h14M2 14h14" />
              )}
            </svg>
          </button>

          <Link href="/terminal" className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-wider">
              <span className="text-neon-green">SYNTH</span>
              <span className="text-text-primary">EDGE</span>
            </span>
            <span className="font-mono text-[9px] text-text-muted tracking-wider ml-1 hidden sm:inline">TERMINAL</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Status Indicators */}
          <div className="hidden sm:flex items-center gap-3 font-mono text-[10px] tracking-wider">
            <span className={synthApiKey ? "text-neon-green" : "text-text-muted"}>
              SYNTH {synthApiKey ? "[CONNECTED]" : "[NO_KEY]"}
            </span>
            <span className="text-border-dim">|</span>
            <WalletConnect />
          </div>

          <span className="text-border-dim hidden sm:inline">|</span>

          {/* Horizon Toggle */}
          <div className="flex border border-border-dim">
            <button
              onClick={() => setHorizon("1h")}
              className={cn(
                "px-2 sm:px-3 py-1 font-mono text-[11px] tracking-wider transition-all",
                horizon === "1h"
                  ? "bg-neon-green/15 text-neon-green"
                  : "text-text-muted hover:text-text-secondary bg-bg-sidebar"
              )}
            >
              1H
            </button>
            <button
              onClick={() => setHorizon("24h")}
              className={cn(
                "px-2 sm:px-3 py-1 font-mono text-[11px] tracking-wider transition-all border-l border-border-dim",
                horizon === "24h"
                  ? "bg-neon-green/15 text-neon-green"
                  : "text-text-muted hover:text-text-secondary bg-bg-sidebar"
              )}
            >
              24H
            </button>
          </div>
        </div>
      </header>

      {/* Ticker Tape */}
      <TickerTape />

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav
          className={cn(
            "w-48 bg-bg-sidebar border-r border-border-dim flex flex-col shrink-0 z-40 transition-transform duration-200",
            // Mobile: overlay off-screen, slide in when open
            "fixed lg:relative top-0 left-0 h-full",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Logo */}
          <div className="px-4 py-4 border-b border-border-dim">
            <div className="font-mono text-[11px] tracking-widest text-neon-green font-bold">
              SYNTHEDGE
            </div>
            <div className="font-mono text-[9px] text-text-muted tracking-wider mt-0.5">
              PREDICTIVE INTELLIGENCE
            </div>
          </div>

          {/* Mobile-only: wallet + status */}
          <div className="sm:hidden px-4 py-3 border-b border-border-dim space-y-2">
            <div className="font-mono text-[10px] tracking-wider">
              <span className={synthApiKey ? "text-neon-green" : "text-text-muted"}>
                SYNTH {synthApiKey ? "[CONNECTED]" : "[NO_KEY]"}
              </span>
            </div>
            <WalletConnect />
          </div>

          {/* Nav Items */}
          <div className="flex-1 py-2 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/terminal"
                  ? pathname === "/terminal"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 font-mono text-[11px] tracking-wider uppercase transition-all border-l-2",
                    isActive
                      ? "border-l-neon-green bg-neon-green/5 text-neon-green"
                      : "border-l-transparent text-text-muted hover:text-text-secondary hover:bg-bg-hover hover:border-l-text-muted"
                  )}
                >
                  <span className="text-base w-5 text-center">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* System Info */}
          <div className="px-4 py-3 border-t border-border-dim space-y-1">
            <div className="font-mono text-[9px] text-text-muted tracking-wider">
              // SYSTEM
            </div>
            <div className="font-mono text-[9px] text-text-muted tracking-wider flex justify-between">
              <span>STATUS</span>
              <span className="text-neon-green">[ACTIVE]</span>
            </div>
            <div className="font-mono text-[9px] text-text-muted tracking-wider flex justify-between">
              <span>POLLING</span>
              <span>10s</span>
            </div>
            <div className="font-mono text-[9px] text-text-muted tracking-wider flex justify-between">
              <span>VERSION</span>
              <span>v0.1.1</span>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-2 sm:p-4 bg-bg-primary">{children}</main>
      </div>

      {/* Status Bar */}
      <footer className="h-6 flex items-center justify-between px-3 sm:px-4 bg-bg-sidebar border-t border-border-dim shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 font-mono text-[10px] tracking-wider">
          <span className="text-neon-green">● SYNTH_API</span>
          <span className="text-text-muted hidden sm:inline">
            HORIZON: {horizon.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 font-mono text-[10px] tracking-wider text-text-muted">
          <a href="https://x.com/synthedge_xyz" target="_blank" rel="noopener noreferrer" className="text-neon-green/60 hover:text-neon-green hidden sm:inline">TWITTER</a>
          <span className="hidden sm:inline">
            Powered by{" "}
            <a
              href="https://www.tradingview.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neon-green/60 hover:text-neon-green"
            >
              TradingView
            </a>
          </span>
          <UtcClock />
        </div>
      </footer>
    </div>
    </>
  );
}

function UtcClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => setTime(new Date().toISOString().slice(11, 19));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return <span>UTC {time}</span>;
}
