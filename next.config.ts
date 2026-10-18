import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The dev indicator sits bottom-left by default, over the first bottom-nav item at 375 px; the header's right side is free.
  devIndicators: { position: 'top-right' },
  async headers() {
    return [
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
