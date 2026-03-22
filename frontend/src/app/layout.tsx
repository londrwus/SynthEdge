import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://synthedge.xyz";
const SITE_NAME = "SynthEdge";
const TITLE = "SynthEdge — Predictive Intelligence Meets On-Chain Execution";
const DESCRIPTION =
  "AI-powered probabilistic trading terminal built on Synth predictive data. Real-time price forecasts, probability cones, volatility analytics, regime detection, and Hyperliquid on-chain execution for BTC, ETH, SOL, SPY, NVDA, TSLA, AAPL, GOOGL, and XAU.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | SynthEdge",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "SynthEdge",
    "Synth",
    "Synthdata",
    "Synth API",
    "Synth predictive data",
    "predictive intelligence",
    "probabilistic trading",
    "AI price forecasts",
    "probability cones",
    "volatility analytics",
    "regime detection",
    "Hyperliquid",
    "Hyperliquid trading",
    "on-chain execution",
    "crypto trading terminal",
    "equity perps",
    "BTC forecast",
    "ETH forecast",
    "SOL forecast",
    "SPY forecast",
    "NVDA forecast",
    "TSLA forecast",
    "AAPL forecast",
    "GOOGL forecast",
    "XAU forecast",
    "VaR",
    "Kelly criterion",
    "position sizing",
    "risk management",
    "trading signals",
    "DeFi trading",
    "quantitative trading",
  ],
  authors: [{ name: "SynthEdge" }],
  creator: "SynthEdge",
  publisher: "SynthEdge",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/twitter-banner.png",
        width: 1200,
        height: 630,
        alt: "SynthEdge — Predictive Intelligence Meets On-Chain Execution",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@synthedge_xyz",
    creator: "@synthedge_xyz",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/twitter-banner.png"],
  },
  alternates: {
    canonical: SITE_URL,
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  category: "Finance",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "AI-powered price probability forecasts",
    "Real-time probability cone visualization",
    "Volatility heatmap across 9 assets",
    "Directional scanner with conviction scoring",
    "Regime detection (low vol, high vol, mean reversion, tail risk)",
    "VaR and CVaR risk analytics",
    "Kelly criterion position sizing",
    "Hyperliquid on-chain trade execution",
    "Portfolio monitoring with Synth risk enrichment",
  ],
  keywords:
    "Synth, Synthdata, predictive intelligence, probabilistic trading, Hyperliquid, crypto, equities, AI forecasts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${jetbrainsMono.variable} ${inter.variable} bg-bg-primary text-text-primary antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
