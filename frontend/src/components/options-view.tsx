"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatPrice, cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/useSettingsStore";

interface OptionsViewProps {
  asset: string;
}

export function OptionsView({ asset }: OptionsViewProps) {
  const horizon = useSettingsStore((s) => s.horizon);
  const { data: res, isLoading, error } = useQuery({
    queryKey: ["options", asset, horizon],
    queryFn: () => api.getOptions(asset, horizon),
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-6 bg-neon-green/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !res?.data) {
    return (
      <div className="font-mono text-[10px] text-text-muted tracking-wider p-4 text-center">
        OPTIONS DATA UNAVAILABLE
      </div>
    );
  }

  const data = res.data;
  const current = data.current_price;
  const calls = data.call_options || {};
  const puts = data.put_options || {};
  const analysis = data.analysis || {};

  // Get sorted strike prices
  const strikes = Object.keys(calls)
    .map(Number)
    .sort((a, b) => a - b);

  // Find ATM index
  const atmIdx = strikes.findIndex(
    (s) => Math.abs(s - current) === Math.min(...strikes.map((s2) => Math.abs(s2 - current)))
  );

  return (
    <div className="space-y-3">
      {/* Analysis Summary */}
      <div className="grid grid-cols-2 gap-px bg-border-dim">
        <div className="bg-bg-tertiary p-2">
          <p className="font-mono text-[9px] text-text-muted tracking-wider">ATM_STRIKE</p>
          <p className="font-mono text-[11px] text-text-primary font-semibold">
            ${analysis.atm_strike?.toFixed(2)}
          </p>
        </div>
        <div className="bg-bg-tertiary p-2">
          <p className="font-mono text-[9px] text-text-muted tracking-wider">EXPIRY</p>
          <p className="font-mono text-[11px] text-text-primary font-semibold">
            {data.expiry_time?.slice(0, 16)}
          </p>
        </div>
      </div>

      {/* Options Chain */}
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[10px]">
          <thead>
            <tr className="text-text-muted tracking-wider border-b border-border-dim">
              <th className="text-right px-2 py-1">CALL</th>
              <th className="text-center px-2 py-1">STRIKE</th>
              <th className="text-left px-2 py-1">PUT</th>
            </tr>
          </thead>
          <tbody>
            {strikes.map((strike, i) => {
              const callPrice = calls[strike.toString()] || 0;
              const putPrice = puts[strike.toString()] || 0;
              const isATM = i === atmIdx;
              const isITMCall = strike < current;
              const isITMPut = strike > current;

              return (
                <tr
                  key={strike}
                  className={cn(
                    "border-t border-border-dim/50",
                    isATM && "bg-neon-green/5 border-l-2 border-l-neon-green"
                  )}
                >
                  <td className="text-right px-2 py-1 tabular-nums">
                    <span className={cn(
                      callPrice > 0.01 ? "text-bull" : "text-text-muted",
                      isITMCall && "font-semibold"
                    )}>
                      {callPrice > 0.001 ? callPrice.toFixed(4) : "—"}
                    </span>
                  </td>
                  <td className={cn(
                    "text-center px-2 py-1 tabular-nums",
                    isATM ? "text-neon-green font-bold" : "text-text-secondary"
                  )}>
                    {strike.toFixed(strike >= 100 ? 0 : 2)}
                  </td>
                  <td className="text-left px-2 py-1 tabular-nums">
                    <span className={cn(
                      putPrice > 0.01 ? "text-bear" : "text-text-muted",
                      isITMPut && "font-semibold"
                    )}>
                      {putPrice > 0.001 ? putPrice.toFixed(4) : "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[8px] text-text-muted tracking-wider text-center">
        THEORETICAL PRICES FROM SYNTH MONTE CARLO (1000 PATHS)
      </p>
    </div>
  );
}
