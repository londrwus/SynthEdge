"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { cn } from "@/lib/utils";
import { TickerTape } from "@/components/ticker-tape";

const NAV_ITEMS = [
  { href: "/terminal", icon: "\u25C8", label: "DASHBOARD" },
  { href: "/terminal/asset/BTC", icon: "\u25C9", label: "ASSETS" },
  { href: "/terminal/portfolio", icon: "\uD83D\uDCBC", label: "PORTFOLIO" },
  { href: "/terminal/faq", icon: "?", label: "HELP / FAQ" },
  { href: "/settings", icon: "\u2699", label: "SETTINGS" },
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
  const hlAddress = useSettingsStore((s) => s.hlAddress);

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <header className="h-10 flex items-center justify-between px-4 bg-bg-sidebar border-b border-border-dim shrink-0">
        <Link href="/terminal" className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-wider">
            <span className="text-neon-green">SYNTH</span>
            <span className="text-text-primary">EDGE</span>
          </span>
          <span className="font-mono text-[9px] text-text-muted tracking-wider ml-1">TERMINAL</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Status Indicators */}
          <div className="hidden md:flex items-center gap-3 font-mono text-[10px] tracking-wider">
            <span className={synthApiKey ? "text-neon-green" : "text-text-muted"}>
              SYNTH {synthApiKey ? "[CONNECTED]" : "[NO_KEY]"}
            </span>
            <span className="text-border-dim">|</span>
            <span className={hlAddress ? "text-neon-green" : "text-text-muted"}>
              HL {hlAddress ? "[CONNECTED]" : "[OFFLINE]"}
            </span>
          </div>

          <span className="text-border-dim hidden md:inline">|</span>

          {/* Horizon Toggle */}
          <div className="flex border border-border-dim">
            <button
              onClick={() => setHorizon("1h")}
              className={cn(
                "px-3 py-1 font-mono text-[11px] tracking-wider transition-all",
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
                "px-3 py-1 font-mono text-[11px] tracking-wider transition-all border-l border-border-dim",
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Expanded with text labels */}
        <nav className="w-48 bg-bg-sidebar border-r border-border-dim flex flex-col shrink-0">
          {/* Logo */}
          <div className="px-4 py-4 border-b border-border-dim">
            <div className="font-mono text-[11px] tracking-widest text-neon-green font-bold">
              SYNTHEDGE
            </div>
            <div className="font-mono text-[9px] text-text-muted tracking-wider mt-0.5">
              PREDICTIVE INTELLIGENCE
            </div>
          </div>

          {/* Nav Items */}
          <div className="flex-1 py-2">
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
              <span>v0.1.0</span>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 bg-bg-primary">{children}</main>
      </div>

      {/* Status Bar */}
      <footer className="h-6 flex items-center justify-between px-4 bg-bg-sidebar border-t border-border-dim shrink-0">
        <div className="flex items-center gap-4 font-mono text-[10px] tracking-wider">
          <span className="text-neon-green">● SYNTH_API</span>
          <span className="text-text-muted">
            HORIZON: {horizon.toUpperCase()}
          </span>
          <span className="text-text-muted">
            ASSETS: 9
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] tracking-wider text-text-muted">
          <span>
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
