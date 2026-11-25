import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Resume PDFs are capped at 5 MB in lib/resume.ts; leave room for multipart overhead.
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  // PGlite (demo mode) loads its WASM and the pgvector extension from node_modules at runtime,
  // so it must stay unbundled, and the demo snapshot must ship with every server route.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector"],
  outputFileTracingIncludes: {
    "/**": ["./demo/**/*", "./node_modules/@electric-sql/pglite/dist/**/*", "./node_modules/@electric-sql/pglite-pgvector/dist/**/*"],
  },
  partialPrefetching: true,
  // Search moved from "/" to "/jobs"; old links like /?q=react keep working (query is passed through).
  async redirects() {
    return ["q", "page"].map((key) => ({ source: "/", has: [{ type: "query" as const, key }], destination: "/jobs", permanent: false }));
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
