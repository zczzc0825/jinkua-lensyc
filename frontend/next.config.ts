import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: { middlewareClientMaxBodySize: "200mb" },
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  async rewrites() { return [{ source: "/api/:path*", destination: `${process.env.API_URL || "http://localhost:8000"}/api/:path*` }, { source: "/storage/:path*", destination: `${process.env.API_URL || "http://localhost:8000"}/storage/:path*` }]; }
};
export default nextConfig;
