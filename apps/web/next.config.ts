import type { NextConfig } from "next";

const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:4200";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
