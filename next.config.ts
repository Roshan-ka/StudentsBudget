import { execSync } from "node:child_process";
import type { NextConfig } from "next";
import { assertLegalReady } from "./src/data/legal";
import { securityHeaders } from "./src/lib/security-headers";

// A Production build needs the Impressum's and the privacy notice's details filled in (legal pages, chunk 1).
assertLegalReady(process.env.VERCEL_ENV);

/**
 * The commit this build is made from. It names the offline cache, so a new commit starts a new cache. It has to be
 * the same in every build worker, so it comes from the host's commit variable or from git, never from the clock.
 */
function buildVersion(): string {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromHost) return fromHost;
  try {
    const head = execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return head || "local";
  } catch {
    // No git, or not a checkout (a source archive, say).
    return "local";
  }
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The `env` key inlines a value computed here into the client bundle at build time (docs: next.config.js `env`).
  env: { NEXT_PUBLIC_BUILD_VERSION: buildVersion() },
  // The dev indicator sits bottom-left by default, over the first bottom-nav item at 375 px; the header's right side is free.
  devIndicators: { position: 'top-right' },
  async headers() {
    return [
      {
        // The security headers on every path (legal pages, chunk 4): the Content-Security-Policy and the rest.
        source: '/:path*',
        headers: securityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          dev: process.env.NODE_ENV === 'development',
          vercelEnv: process.env.VERCEL_ENV,
        }),
      },
      {
        // The browser must ask for the worker script again on every check, or an installed app never hears of an update.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
