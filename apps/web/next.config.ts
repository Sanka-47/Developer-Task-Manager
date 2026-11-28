import path from "node:path";

import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4200";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Trace files from the monorepo root so the standalone server includes the
  // compiled @taskapp/shared workspace package.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@taskapp/shared"],
  async rewrites() {
    // Proxying keeps the browser on one origin, so the httpOnly refresh
    // cookie is same-site and no CORS handling is needed in the browser.
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
