import { NextRequest, NextResponse } from "next/server";

/**
 * Hostname-based routing:
 *   synthedge.xyz       → Landing page only (/)
 *   app.synthedge.xyz   → Terminal app (rewrites to /terminal/*)
 *
 * In local dev, everything works as before on localhost.
 */

const APP_HOSTS = ["app.synthedge.xyz"];
const LANDING_HOSTS = ["synthedge.xyz", "www.synthedge.xyz"];

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] || "";
  const { pathname } = request.nextUrl;

  // --- APP SUBDOMAIN (app.synthedge.xyz) ---
  if (APP_HOSTS.includes(hostname)) {
    // Redirect root landing page to terminal dashboard
    if (pathname === "/") {
      return NextResponse.rewrite(new URL("/terminal", request.url));
    }

    // Already has /terminal prefix — let it through
    if (pathname.startsWith("/terminal")) {
      return NextResponse.next();
    }

    // Skip Next.js internals and static files
    if (
      pathname.startsWith("/_next") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/icon") ||
      pathname.includes(".")
    ) {
      return NextResponse.next();
    }

    // Rewrite /screener → /terminal/screener, /asset/BTC → /terminal/asset/BTC, etc.
    return NextResponse.rewrite(new URL(`/terminal${pathname}`, request.url));
  }

  // --- ROOT DOMAIN (synthedge.xyz) ---
  if (LANDING_HOSTS.includes(hostname)) {
    // Serve landing page at /
    if (pathname === "/") {
      return NextResponse.next();
    }

    // Redirect /terminal/* to app subdomain without /terminal prefix
    if (pathname.startsWith("/terminal")) {
      const appPath = pathname.replace(/^\/terminal/, "") || "/";
      return NextResponse.redirect(
        new URL(`https://app.synthedge.xyz${appPath}`)
      );
    }

    // Any other path on root domain → redirect to app subdomain
    if (
      !pathname.startsWith("/_next") &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/icon") &&
      !pathname.includes(".")
    ) {
      return NextResponse.redirect(
        new URL(`https://app.synthedge.xyz${pathname}`)
      );
    }
  }

  // --- LOCAL DEV (localhost) — no routing changes ---
  return NextResponse.next();
}

export const config = {
  // Skip static files and Next.js internals for performance
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
