import type { MetadataRoute } from "next";

const SITE_URL = "https://synthedge.xyz";

const ASSETS = ["BTC", "ETH", "SOL", "SPY", "NVDA", "TSLA", "AAPL", "GOOGL", "XAU"];

export default function sitemap(): MetadataRoute.Sitemap {
  const assetPages = ASSETS.map((symbol) => ({
    url: `${SITE_URL}/terminal/asset/${symbol}`,
    lastModified: new Date(),
    changeFrequency: "hourly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/terminal`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/terminal/signals`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/terminal/screener`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/terminal/earnings`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/terminal/risk`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/terminal/portfolio`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/terminal/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...assetPages,
  ];
}
