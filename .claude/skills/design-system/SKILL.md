# SKILL: Design System — Terminal Neon + Pencil.dev Autonomy

## Overview
SynthEdge uses a "Terminal Neon" design language: dark, dense, glowing green. Inspired by Bloomberg terminals, cyberpunk UIs, and game HUDs.

**Pencil.dev is the design authority.** It makes all decisions about layout, spacing, component choice, and visual hierarchy. The rules below are constraints/guardrails — within them, Pencil has full creative freedom.

## Pencil.dev — Autonomous Design Authority

### What Pencil Decides (full autonomy)
- **Layout and grid structure** — how panels are arranged, column widths, responsive breakpoints
- **Component selection** — which shadcn/ui components to use, or whether to go custom
- **Spacing and sizing** — padding, margins, gaps (must use multiples of 4px)
- **Visual hierarchy** — what gets emphasis, what recedes
- **Animation choices** — where to animate, transition timing, easing curves
- **Chart library for each visualization** — Pencil picks between:
  - **TradingView Lightweight Charts** — for price/candlestick charts
  - **D3.js** — for custom probabilistic visualizations (cones, heatmaps)
  - **Recharts** — for simpler bar/line charts if faster to implement
  - **CSS-only** — for simple gauges, progress bars, heatmap cells
  - **Canvas API** — if performance demands it
- **Icon library** — Lucide (already in shadcn), Phosphor, or none
- **Any UI library additions** — if Pencil thinks we need react-resizable-panels, cmdk, vaul, etc. — just add them

### What Pencil MUST Follow (constraints)
- Dark theme ONLY — backgrounds: #0a0a0f, #111118, #1a1a24
- Primary accent: #00ff88 (neon green)
- Bearish color: #ff3366
- Neutral: #ffd700
- All financial numbers in monospace (JetBrains Mono)
- Labels and body text in Inter
- Max border radius: rounded-lg (no pill shapes, no rounded-3xl)
- Cards must have subtle green glow border: `border border-[rgba(0,255,136,0.15)]`
- No light mode, no white backgrounds, no light grays
- TradingView attribution link in footer (Apache 2.0 requirement)

### Pencil Prompt Template (for Claude Code → Pencil MCP)
```
Design a [page/component] for SynthEdge, a dark crypto/equity trading terminal.

Brand constraints:
- Backgrounds: #0a0a0f (base), #111118 (cards), #1a1a24 (elevated)
- Accent: #00ff88 (neon green, use sparingly)
- Bear: #ff3366, Neutral: #ffd700
- Fonts: Inter (text), JetBrains Mono (numbers/data)
- Style: Bloomberg terminal density, cyberpunk/game HUD feel
- Subtle green glow on important elements

Requirements:
[specific requirements for this page/component]

You have full autonomy on layout, component choices, spacing, animations, 
and which chart/visualization library to use for each element.
Use shadcn/ui as base. Output as React + Tailwind.
```

### Pencil Pages to Design (ONLY 2 for hackathon)

**1. Dashboard Overview** (`dashboard.pen`)
```
Main trading terminal dashboard. Must show:
- Top bar: scrolling asset ticker with prices and direction arrows
- Left: collapsible sidebar with navigation icons
- Center-top: Directional scanner table (9 assets, columns: Asset, Price, 
  Direction, Probability %, Vol, Regime, quick-action button)
- Center-bottom-left: Probability cone chart for selected asset
- Center-bottom-right: Volatility heatmap (9 assets × 2 horizons grid)
- Bottom: status bar showing connection status, last update time

Make it feel like a game cockpit. Dense with data. 
Probability should be the hero — big, glowing numbers.
```

**2. Asset Deep-Dive** (`asset-detail.pen`)
```
Single asset analysis page. Must show:
- Header: asset name, price, 24h change, regime badge
- Large probability cone chart (full width, ~400px tall)
- Below chart, 3-column grid:
  - Col 1: Risk metrics (VaR, tail risk percentages, liquidation risk)
  - Col 2: Kelly calculator (entry, TP, SL inputs → recommended size)
  - Col 3: Funding rate vs Synth comparison, IV vs Synth vol
- Optional bottom: portfolio positions for this asset (if HL connected)

Horizon toggle (1h / 24h) affects all data on the page.
```

## Tailwind Config
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#111118',
          tertiary: '#1a1a24',
          hover: '#22222e',
        },
        neon: {
          green: '#00ff88',
          'green-muted': '#00cc6a',
          'green-50': 'rgba(0, 255, 136, 0.06)',
          'green-20': 'rgba(0, 255, 136, 0.2)',
        },
        bull: '#00ff88',
        bear: '#ff3366',
        neutral: '#ffd700',
        warning: '#ff8800',
      },
      fontFamily: {
        mono: ['var(--font-jetbrains)', 'monospace'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 20px rgba(0, 255, 136, 0.1)',
        'neon-strong': '0 0 30px rgba(0, 255, 136, 0.2)',
        'neon-bull': '0 0 15px rgba(0, 255, 136, 0.15)',
        'neon-bear': '0 0 15px rgba(255, 51, 102, 0.15)',
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'glow': 'glow 1.5s ease-in-out infinite alternate',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        glow: {
          from: { boxShadow: '0 0 10px rgba(0, 255, 136, 0.1)' },
          to: { boxShadow: '0 0 25px rgba(0, 255, 136, 0.3)' },
        },
      },
    },
  },
}
```

## Component Patterns

### Card (Base Container)
```tsx
<div className="bg-bg-secondary border border-neon-green-20 rounded-lg p-4 shadow-neon">
  {children}
</div>
```

### Price Display (Always Monospace)
```tsx
<span className={cn(
  "font-mono text-sm tabular-nums",
  change >= 0 ? "text-bull" : "text-bear"
)}>
  {formatPrice(price)}
</span>
```

### Status Badge
```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono
  bg-neon-green-50 text-neon-green border border-neon-green-20">
  BULLISH 72%
</span>
```

### Probability Bar
```tsx
<div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
  <div 
    className="h-full rounded-full transition-all duration-500"
    style={{ 
      width: `${probability * 100}%`,
      background: `linear-gradient(90deg, #ff3366, #ff8800, #ffd700, #00ff88)`,
      backgroundSize: '400% 100%',
      backgroundPosition: `${probability * 100}% 0`
    }}
  />
</div>
```

### Neon Glow Button
```tsx
<button className="px-4 py-2 bg-neon-green/10 text-neon-green border border-neon-green/30
  rounded-lg font-mono text-sm hover:bg-neon-green/20 hover:shadow-neon-strong
  transition-all duration-200 active:scale-95">
  LONG
</button>
```

## Page Layouts

### Terminal Shell
```
┌─────────────────────────────────────────────────────┐
│ [Logo] SynthEdge    [Asset Ticker Tape →→→]  [⚙️]  │  ← Header (h-12)
├────────┬────────────────────────────────────────────┤
│        │                                            │
│  NAV   │          MAIN CONTENT AREA                 │
│        │                                            │
│  📊    │   (probability cones, charts, signals)     │
│  📈    │                                            │
│  🎯    │                                            │
│  📋    │                                            │
│  ⚡    │                                            │
│        │                                            │
├────────┴────────────────────────────────────────────┤
│ [Status] Connected: Synth ✓ HL ✓  │ Last: 2s ago  │  ← StatusBar (h-8)
└─────────────────────────────────────────────────────┘
```
Sidebar: w-16 (collapsed icons) or w-56 (expanded with labels)

### Dashboard Grid (Overview Page)
```
┌───────────────────────┬────────────────────────────┐
│   DIRECTIONAL SCANNER │   VOLATILITY HEATMAP       │
│   (all assets table)  │   (grid visualization)     │
│                       │                            │
├───────────────────────┼────────────────────────────┤
│   PROBABILITY CONE    │   PORTFOLIO SUMMARY        │
│   (featured asset)    │   (positions + P&L)        │
│                       │                            │
├───────────────────────┴────────────────────────────┤
│   SIGNAL FEED  (latest alerts, funding arb, etc.)  │
└────────────────────────────────────────────────────┘
```

### Asset Deep-Dive Page
```
┌────────────────────────────────────────────────────┐
│  [BTC] Bitcoin  $84,500  +2.3%   [1h] [24h]       │
├─────────────────────────────┬──────────────────────┤
│                             │   TRADE PANEL        │
│   PROBABILITY CONE          │   ┌────────────────┐ │
│   (full width chart with    │   │ LONG  │ SHORT  │ │
│    TradingView overlay)     │   │ Size: ___      │ │
│                             │   │ Leverage: 5x   │ │
│                             │   │ Kelly: 12%     │ │
│                             │   │ SL: $82,100    │ │
│                             │   │ TP: $87,200    │ │
│                             │   │ [EXECUTE]      │ │
│                             │   └────────────────┘ │
├──────────┬──────────┬───────┴──────────────────────┤
│ REGIME   │ TAIL RISK│  FUNDING RATE / IV COMPARE   │
│ Low Vol  │ 2.1% >5% │  Funding: -0.02% │ IV: 45%  │
│ Grind    │ drop prob │  Synth Vol: 42%  │ Edge: 3% │
└──────────┴──────────┴──────────────────────────────┘
```

## Chart Libraries

### TradingView Lightweight Charts
- Candlestick / line charts for price data
- Apache 2.0 license — MUST add attribution link
- 45KB, very performant
- Use for: main price chart, historical price overlay
- React wrapper: build custom hook `useLightweightChart()`

### D3.js
- Custom probability cone visualization
- Volatility heatmap
- Distribution histogram
- Probability gauges
- Use SVG for interactive elements, Canvas for performance-heavy renders

### Chart Color Rules
- Green (#00ff88) for bullish/up/positive
- Pink/Red (#ff3366) for bearish/down/negative
- Gold (#ffd700) for neutral/median
- Orange (#ff8800) for warnings
- Purple (#8b5cf6) for secondary data series
- Gridlines: rgba(255,255,255,0.05)
- Axis labels: #475569 (text-tertiary)

## Animation Guidelines
- **Transitions:** 200ms for hover, 300ms for state changes
- **Loading:** Pulsing neon green bars, never circular spinners
- **Numbers:** Animate value changes with `framer-motion` layoutAnimation
- **Charts:** Smooth data transitions, no jarring redraws
- **Glow effects:** Use CSS animation, 1.5-2s cycle, subtle
- **Don't:** Flash, bounce, or use excessive motion. This is a professional tool.

## Typography Scale
```
Heading 1: text-xl font-bold font-sans     (page titles)
Heading 2: text-base font-semibold font-sans (card titles)
Body:      text-sm font-normal font-sans    (descriptions)
Data:      text-sm font-mono tabular-nums   (prices, %, numbers)
Label:     text-xs font-medium text-secondary (field labels)
Ticker:    text-xs font-mono uppercase       (asset symbols)
```
