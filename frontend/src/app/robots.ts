import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/terminal/settings"],
      },
    ],
    sitemap: "https://synthedge.xyz/sitemap.xml",
  };
}
