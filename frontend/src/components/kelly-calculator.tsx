"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatPercent, cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface KellyCalculatorProps {
  asset: string;
  currentPrice?: number;
}

export function KellyCalculator({ asset, currentPrice }: KellyCalculatorProps) {
  const horizon = useSettingsStore((s) => s.horizon);
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [entry, setEntry] = useState(currentPrice?.toString() || "");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.calculateKelly({
        asset,
        direction,
        entry: parseFloat(entry),
        tp: parseFloat(tp),
        sl: parseFloat(sl),
        horizon,
      }),
  });

  const handleCalculate = () => {
    if (entry && tp && sl) {
      mutation.mutate();
    }
  };

  // Auto-fill entry when currentPrice changes
  if (currentPrice && !entry) {
    setEntry(currentPrice.toString());
  }

  const result = mutation.data?.data;

  return (
    <div className="space-y-3">
      {/* Direction Toggle */}
      <div className="flex border border-border-dim">
        <button
          onClick={() => setDirection("long")}
          className={cn(
            "flex-1 py-1.5 font-mono text-[10px] tracking-wider transition-all",
            direction === "long"
              ? "bg-bull/15 text-bull border-r border-border-dim"
              : "bg-bg-tertiary text-text-muted border-r border-border-dim"
          )}
        >
          LONG
        </button>
        <button
          onClick={() => setDirection("short")}
          className={cn(
            "flex-1 py-1.5 font-mono text-[10px] tracking-wider transition-all",
            direction === "short"
              ? "bg-bear/15 text-bear"
              : "bg-bg-tertiary text-text-muted"
          )}
        >
          SHORT
        </button>
      </div>

      {/* Inputs */}
      <InputField label="ENTRY_PRICE" value={entry} onChange={setEntry} />
      <InputField label="TAKE_PROFIT" value={tp} onChange={setTp} />
      <InputField label="STOP_LOSS" value={sl} onChange={setSl} />

      <button
        onClick={handleCalculate}
        disabled={!entry || !tp || !sl}
        className="w-full py-2 bg-neon-green/10 text-neon-green border border-neon-green/20 font-mono text-[10px] uppercase tracking-wider hover:bg-neon-green/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        CALCULATE
      </button>

      {/* Results */}
      {result && (
        <div className="space-y-2 pt-2 border-t border-border-dim">
          <div className="text-center py-2">
            <p className="font-mono text-[9px] text-text-muted tracking-wider">RECOMMENDED_SIZE</p>
            <p className="font-sans text-2xl font-bold text-neon-green tabular-nums">
              {result.recommended_position_pct.toFixed(1)}%
            </p>
            <p className="font-mono text-[9px] text-text-muted tracking-wider">OF PORTFOLIO</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border-dim">
            <div className="bg-bg-tertiary p-2">
              <p className="font-mono text-[9px] text-text-muted tracking-wider">WIN_PROB</p>
              <p className="font-mono text-[11px] text-bull font-semibold">{formatPercent(result.win_probability)}</p>
            </div>
            <div className="bg-bg-tertiary p-2">
              <p className="font-mono text-[9px] text-text-muted tracking-wider">LOSS_PROB</p>
              <p className="font-mono text-[11px] text-bear font-semibold">{formatPercent(result.loss_probability)}</p>
            </div>
            <div className="bg-bg-tertiary p-2">
              <p className="font-mono text-[9px] text-text-muted tracking-wider">AVG_WIN</p>
              <p className="font-mono text-[11px] text-text-primary">{formatPercent(result.avg_win_pct)}</p>
            </div>
            <div className="bg-bg-tertiary p-2">
              <p className="font-mono text-[9px] text-text-muted tracking-wider">AVG_LOSS</p>
              <p className="font-mono text-[11px] text-text-primary">{formatPercent(result.avg_loss_pct)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block font-mono text-[9px] text-text-muted uppercase tracking-wider mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-tertiary border border-border-dim px-3 py-1.5 font-mono text-[11px] text-text-primary tabular-nums focus:outline-none focus:border-neon-green/30 transition-all"
      />
    </div>
  );
}
